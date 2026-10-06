import * as Phaser from 'phaser';
import { backingSize, clampPixelRatio } from './render-math.js';

/**
 * HiDPI support. Phaser 4 has no `resolution` option and its RESIZE mode sizes the canvas backing
 * store in CSS pixels, which is blurry on devicePixelRatio > 1 screens. Instead the game runs in
 * `Scale.NONE` mode with a backing store of `css size * dpr` and `scale.zoom = 1 / dpr`, so the canvas
 * is displayed at its CSS size. Phaser converts pointer positions with its display scale, so pointer
 * coordinates, `scale.width/height` and camera sizes are all in device pixels.
 *
 * The current ratio is published in the game registry under {@link PIXEL_RATIO_KEY}; scenes read it
 * with {@link getPixelRatio} and listen to `changedata-<key>` for changes (window moved to another
 * monitor, browser zoom).
 */

export const PIXEL_RATIO_KEY = 'td.pixelRatio';

export function readDevicePixelRatio(): number {
  return clampPixelRatio(
    typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  );
}

/** Pixel ratio the game renders at (1 when not published yet). */
export function getPixelRatio(scene: Phaser.Scene): number {
  const value: unknown = scene.registry.get(PIXEL_RATIO_KEY);
  return typeof value === 'number' && value > 0 ? value : 1;
}

/** Initial `scale` config: backing store sized to the parent in device pixels. */
export function hiDpiScaleConfig(
  parent: HTMLElement,
  dpr: number,
): Phaser.Types.Core.ScaleConfig {
  const size = backingSize(parent.clientWidth, parent.clientHeight, dpr);
  return {
    mode: Phaser.Scale.NONE,
    width: size.width,
    height: size.height,
    zoom: 1 / dpr,
    // The host sizes the parent; never let Phaser rewrite html/body/parent CSS.
    expandParent: false,
  };
}

/**
 * Keeps the canvas backing store at `parent CSS size * devicePixelRatio`: a ResizeObserver on the
 * parent plus a `resolution` media query for ratio changes. Returns the disconnect function.
 */
export function attachHiDpiSizing(
  game: Phaser.Game,
  parent: HTMLElement,
  initialDpr: number,
): () => void {
  let dpr = initialDpr;
  let cssWidth = parent.clientWidth;
  let cssHeight = parent.clientHeight;
  let disposed = false;
  let observer: ResizeObserver | null = null;
  let media: MediaQueryList | null = null;

  game.registry.set(PIXEL_RATIO_KEY, dpr);

  const apply = (): void => {
    if (disposed || !game.isBooted || !game.canvas) return;
    const nextDpr = readDevicePixelRatio();
    const size = backingSize(cssWidth, cssHeight, nextDpr);
    const scale = game.scale;
    const dprChanged = nextDpr !== dpr;
    if (
      !dprChanged &&
      scale.width === size.width &&
      scale.height === size.height
    )
      return;
    if (dprChanged) {
      dpr = nextDpr;
      scale.zoom = 1 / dpr;
      watchResolution();
    }
    // CSS size first: `resize()` refreshes the display scale from the canvas client rect.
    const style = game.canvas.style;
    style.width = `${size.width / dpr}px`;
    style.height = `${size.height / dpr}px`;
    scale.resize(size.width, size.height);
    if (dprChanged) game.registry.set(PIXEL_RATIO_KEY, dpr);
  };

  const onMediaChange = (): void => apply();

  function watchResolution(): void {
    media?.removeEventListener('change', onMediaChange);
    media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(resolution: ${dpr}dppx)`)
        : null;
    media?.addEventListener('change', onMediaChange);
  }

  const start = (): void => {
    if (disposed) return;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        cssWidth = entry.contentRect.width;
        cssHeight = entry.contentRect.height;
        apply();
      });
      observer.observe(parent);
    }
    watchResolution();
    apply();
  };

  if (game.isBooted) start();
  else game.events.once(Phaser.Core.Events.READY, start);

  return () => {
    disposed = true;
    observer?.disconnect();
    observer = null;
    media?.removeEventListener('change', onMediaChange);
    media = null;
    game.events.off(Phaser.Core.Events.READY, start);
  };
}

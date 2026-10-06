/**
 * Pure rendering helpers (no Phaser): interpolation, colors, rectangles and camera math.
 * Kept free of Phaser imports so they can be unit-tested in a Node environment.
 */
import type { EntityId, Vec2 } from '@td/shared';

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Rebuilds `out` as an id -> item index of `items` (the map is reused to avoid per-frame allocations). */
export function indexById<T extends { readonly id: EntityId }>(
  items: readonly T[],
  out: Map<EntityId, T>,
): Map<EntityId, T> {
  out.clear();
  for (const item of items) out.set(item.id, item);
  return out;
}

/**
 * Interpolated render position of an entity between the previous and the current tick.
 * Entities that did not exist at the previous tick are rendered at their current position.
 */
export function interpolatePos(
  previous: Vec2 | undefined,
  current: Vec2,
  alpha: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  if (!previous) {
    out.x = current.x;
    out.y = current.y;
  } else {
    const t = clamp(alpha, 0, 1);
    out.x = lerp(previous.x, current.x, t);
    out.y = lerp(previous.y, current.y, t);
  }
  return out;
}

const HP_FULL = 0x22c55e;
const HP_EMPTY = 0xef4444;

/** Linear blend of two 0xRRGGBB colors. */
export function mixColor(from: number, to: number, t: number): number {
  const k = clamp(t, 0, 1);
  const r = Math.round(lerp((from >> 16) & 0xff, (to >> 16) & 0xff, k));
  const g = Math.round(lerp((from >> 8) & 0xff, (to >> 8) & 0xff, k));
  const b = Math.round(lerp(from & 0xff, to & 0xff, k));
  return (r << 16) | (g << 8) | b;
}

/** HP bar color: green at full health, red when empty. */
export function hpColor(ratio: number): number {
  return mixColor(HP_EMPTY, HP_FULL, ratio);
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

/** Element-wise equality of two numeric arrays (same reference short-circuits). */
export function numbersEqual(
  a: readonly number[],
  b: readonly number[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Minimal camera description (Phaser main camera with origin 0.5, no rotation, at viewport 0,0). */
export interface CameraView {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Viewport pixel -> world point, matching the Phaser 4 camera matrix
 * (screen = origin + zoom * (world - scroll - origin), origin = size / 2).
 * Computed analytically so it is correct even before the camera matrix is refreshed for the frame.
 */
export function viewToWorld(
  cam: CameraView,
  px: number,
  py: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const ox = cam.width / 2;
  const oy = cam.height / 2;
  out.x = (px - ox) / cam.zoom + cam.scrollX + ox;
  out.y = (py - oy) / cam.zoom + cam.scrollY + oy;
  return out;
}

/** Scroll that keeps the world point currently under (px, py) fixed after zooming to `newZoom`. */
export function scrollForZoomAround(
  cam: CameraView,
  px: number,
  py: number,
  newZoom: number,
): { scrollX: number; scrollY: number } {
  const anchor = viewToWorld(cam, px, py, { x: 0, y: 0 });
  const ox = cam.width / 2;
  const oy = cam.height / 2;
  return {
    scrollX: anchor.x - ox - (px - ox) / newZoom,
    scrollY: anchor.y - oy - (py - oy) / newZoom,
  };
}

/** Largest zoom that fits a world rectangle of `contentW` x `contentH` inside the viewport (with margin). */
export function fitZoom(
  viewW: number,
  viewH: number,
  contentW: number,
  contentH: number,
  min: number,
  max: number,
  margin = 0.9,
): number {
  if (viewW <= 0 || viewH <= 0 || contentW <= 0 || contentH <= 0)
    return clamp(1, min, max);
  return clamp(Math.min(viewW / contentW, viewH / contentH) * margin, min, max);
}

/** True when a keyboard event comes from a text field, so game shortcuts must ignore it. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Smallest power of two >= n (n >= 1). */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Highest device pixel ratio honoured (beyond it the GPU fill-rate cost outweighs the sharpness). */
export const MAX_PIXEL_RATIO = 3;

/** Sanitized device pixel ratio in [1, MAX_PIXEL_RATIO]. */
export function clampPixelRatio(dpr: number | undefined): number {
  if (dpr === undefined || !Number.isFinite(dpr) || dpr < 1) return 1;
  return Math.min(dpr, MAX_PIXEL_RATIO);
}

/** Canvas backing-store size (device pixels, at least 1x1) for a CSS box and a pixel ratio. */
export function backingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr)),
  };
}

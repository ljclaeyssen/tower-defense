import * as Phaser from 'phaser';
import type {
  LaunchGalleryOptions,
  LaunchGameOptions,
  LaunchedGallery,
  LaunchedGame,
} from './api.js';
import { LocalGameBridge } from './bridge/game-bridge.js';
import {
  attachHiDpiSizing,
  hiDpiScaleConfig,
  readDevicePixelRatio,
} from './display.js';
import { GALLERY_SCENE_KEY, GalleryScene } from './scenes/gallery-scene.js';
import type { GallerySceneData } from './scenes/gallery-scene.js';
import { DEFAULT_ASSETS_BASE_URL } from './visuals/atlas.js';
import { GAME_SCENE_KEY, GameScene } from './scenes/game-scene.js';
import type { GameSceneData } from './scenes/game-scene.js';

const BACKGROUND = '#0b1020';

/** Debug affordance: the Phaser game is reachable from the host element in devtools. */
type PhaserHost = HTMLElement & { __phaserGame?: Phaser.Game };

interface MountedGame {
  readonly game: Phaser.Game;
  /** Disconnects the HiDPI sizing and destroys the game (removing its canvas). */
  readonly destroy: () => void;
}

function createPhaserGame(parent: HTMLElement): MountedGame {
  const dpr = readDevicePixelRatio();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: BACKGROUND,
    // Block display: an inline canvas adds a baseline gap that overflows a parent of the same height.
    canvasStyle: 'display: block',
    // HiDPI: backing store in device pixels, displayed at CSS size (see display.ts).
    scale: hiDpiScaleConfig(parent, dpr),
    // Scenes are added explicitly so they can receive their data.
    scene: [],
    banner: false,
    disableContextMenu: true,
    input: { keyboard: true, mouse: { preventDefaultWheel: true } },
    // Baked textures (supersampled power-of-two canvases) and the @2x atlas are displayed downscaled:
    // mipmaps keep them smooth when zoomed out.
    render: { antialias: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  });
  (parent as PhaserHost).__phaserGame = game;
  const detachSizing = attachHiDpiSizing(game, parent, dpr);
  return {
    game,
    destroy: () => {
      detachSizing();
      if ((parent as PhaserHost).__phaserGame === game)
        delete (parent as PhaserHost).__phaserGame;
      game.destroy(true);
    },
  };
}

/**
 * Mounts the Phaser game in `parent` and wires it to `session`. Does not start the session: the host
 * calls `session.start()` (and `session.destroy()`) itself.
 */
export function launchGame({
  parent,
  session,
  assetsBaseUrl = DEFAULT_ASSETS_BASE_URL,
}: LaunchGameOptions): LaunchedGame {
  const bridge = new LocalGameBridge(session);
  const mounted = createPhaserGame(parent);
  const data: GameSceneData = { session, bridge, assetsBaseUrl };
  mounted.game.scene.add(GAME_SCENE_KEY, GameScene, true, data);

  let destroyed = false;
  return {
    bridge,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      bridge.destroy();
      mounted.destroy();
    },
  };
}

/** Mounts the asset gallery (atlas frames listed by the manifest, else the placeholders) in `parent`. */
export function launchGallery({
  parent,
  assetsBaseUrl = DEFAULT_ASSETS_BASE_URL,
}: LaunchGalleryOptions): LaunchedGallery {
  const mounted = createPhaserGame(parent);
  const data: GallerySceneData = { assetsBaseUrl };
  mounted.game.scene.add(GALLERY_SCENE_KEY, GalleryScene, true, data);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      mounted.destroy();
    },
  };
}

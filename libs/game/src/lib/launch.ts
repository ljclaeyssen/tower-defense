import * as Phaser from 'phaser';
import type {
  LaunchGalleryOptions,
  LaunchGameOptions,
  LaunchedGallery,
  LaunchedGame,
} from './api.js';
import { LocalGameBridge } from './bridge/game-bridge.js';
import { GALLERY_SCENE_KEY, GalleryScene } from './scenes/gallery-scene.js';
import { GAME_SCENE_KEY, GameScene } from './scenes/game-scene.js';
import type { GameSceneData } from './scenes/game-scene.js';

const BACKGROUND = '#0b1020';

/** Debug affordance: the Phaser game is reachable from the host element in devtools. */
type PhaserHost = HTMLElement & { __phaserGame?: Phaser.Game };

function createPhaserGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: BACKGROUND,
    // Block display: an inline canvas adds a baseline gap that overflows a parent of the same height.
    canvasStyle: 'display: block',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      // The host sizes the parent; never let Phaser rewrite html/body/parent CSS.
      expandParent: false,
    },
    // Scenes are added explicitly so they can receive their data.
    scene: [],
    banner: false,
    disableContextMenu: true,
    input: { keyboard: true, mouse: { preventDefaultWheel: true } },
    render: { antialias: true },
  });
  (parent as PhaserHost).__phaserGame = game;
  return game;
}

/**
 * Mounts the Phaser game in `parent` and wires it to `session`. Does not start the session: the host
 * calls `session.start()` (and `session.destroy()`) itself.
 */
export function launchGame({
  parent,
  session,
}: LaunchGameOptions): LaunchedGame {
  const bridge = new LocalGameBridge(session);
  const game = createPhaserGame(parent);
  const data: GameSceneData = { session, bridge };
  game.scene.add(GAME_SCENE_KEY, GameScene, true, data);

  let destroyed = false;
  return {
    bridge,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      bridge.destroy();
      game.destroy(true);
    },
  };
}

/** Mounts the placeholder asset gallery in `parent`. */
export function launchGallery({
  parent,
}: LaunchGalleryOptions): LaunchedGallery {
  const game = createPhaserGame(parent);
  game.scene.add(GALLERY_SCENE_KEY, GalleryScene, true);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      game.destroy(true);
    },
  };
}

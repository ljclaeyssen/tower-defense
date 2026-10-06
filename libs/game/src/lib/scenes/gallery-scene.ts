import * as Phaser from 'phaser';
import { TOWER_TYPE_IDS, getTowerDef } from '@td/shared';
import { CameraController, MAX_ZOOM } from './camera-controller.js';
import { getPixelRatio } from '../display.js';
import {
  CREEP_BODY_KEY,
  CREEP_SHADOW_KEY,
  GROUND_KINDS,
  PROJECTILE_KEY,
  TEXTURE_DISPLAY_SCALE,
  ensureTextures,
  groundTextureKey,
  towerTexture,
} from './textures.js';

export const GALLERY_SCENE_KEY = 'td-gallery';

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#cbd5e1',
};

/** Shorthand: displays a supersampled baked texture at its logical size. */
const D = TEXTURE_DISPLAY_SCALE;

/**
 * Placeholder asset gallery (phase 2 will show the real sprites): every generated texture with a
 * label, on a dark background. Drag to pan, wheel to zoom.
 */
export class GalleryScene extends Phaser.Scene {
  private cameraController: CameraController | null = null;

  constructor() {
    super({ key: GALLERY_SCENE_KEY });
  }

  create(): void {
    ensureTextures(this);
    this.cameras.main.setBackgroundColor('#0b1020');

    const colW = 90;
    let y = 0;

    // Towers: one row per type and team, one column per level.
    for (const type of TOWER_TYPE_IDS) {
      const levels = getTowerDef(type).levels.length;
      for (const team of ['blue', 'red'] as const) {
        for (let level = 1; level <= levels; level++) {
          const info = towerTexture(type, level, team);
          const x = (level - 1) * colW;
          this.add
            .image(x, y + 70, groundTextureKey('grass-a'))
            .setScale(2 * D);
          this.add
            .image(x, y + 70, info.key)
            .setScale(D)
            .setOrigin(info.displayOriginX, info.displayOriginY);
          this.label(x, y + 92, `${type} L${level} ${team}`);
        }
        y += 110;
      }
    }

    // Ground tiles.
    const groundStep = 48;
    GROUND_KINDS.forEach((kind, i) => {
      const x = i * groundStep;
      this.add.image(x, y + 10, groundTextureKey(kind)).setScale(D);
      this.label(x, y + 24, kind);
    });
    y += 50;

    // Creep and projectile.
    this.add
      .image(0, y + 11, CREEP_SHADOW_KEY)
      .setScale(D)
      .setAlpha(0.35);
    this.add.image(0, y + 6, CREEP_BODY_KEY).setScale(D);
    this.label(0, y + 24, 'creep');
    this.add.image(colW, y + 6, PROJECTILE_KEY).setScale(D);
    this.label(colW, y + 24, 'projectile');
    y += 40;

    const bounds = {
      minX: -60,
      maxX: Math.max(colW * 2, (GROUND_KINDS.length - 1) * groundStep) + 60,
      minY: -10,
      maxY: y,
    };
    this.cameraController = new CameraController(this);
    this.cameraController.fit(bounds);
    const onResize = (): void => {
      if (this.cameraController && !this.cameraController.userMoved)
        this.cameraController.fit(bounds);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.cameraController?.destroy();
      this.cameraController = null;
    });
  }

  private label(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        ...LABEL_STYLE,
        resolution: getPixelRatio(this) * MAX_ZOOM,
      })
      .setOrigin(0.5, 0);
  }
}

import * as Phaser from 'phaser';
import {
  FACTION_IDS,
  getFactionDef,
  getFactionTowers,
  getTowerDef,
} from '@td/shared';
import { getPixelRatio } from '../display.js';
import { allProjectileVisualIds } from '../visuals/projectile-registry.js';
import { CameraController, MAX_ZOOM } from './camera-controller.js';
import {
  CREEP_BODY_KEY,
  CREEP_SHADOW_KEY,
  GROUND_KINDS,
  TEXTURE_DISPLAY_SCALE,
  ensureProjectileTexture,
  ensureTextures,
  ensureTowerTexture,
  groundTextureKey,
} from './textures.js';
import { modelIdOf } from '../visuals/model-registry.js';

export const GALLERY_SCENE_KEY = 'td-gallery';

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#cbd5e1',
};
const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  fontStyle: 'bold',
  color: '#ffffff',
};

/** Shorthand: displays a supersampled baked texture at its logical size. */
const D = TEXTURE_DISPLAY_SCALE;

const TEAMS = ['blue', 'red'] as const;
/** Logical layout of the tower grid. */
const ROW_LABEL_W = 170;
const COL_W = 74;
const ROW_H = 86;

/**
 * Placeholder asset gallery (phase 2 will show the real sprites): every tower model grouped by
 * faction, then role (rows), with levels 1-3 in both team colours (columns); the projectile visuals,
 * ground tiles and creep below. Labels are data ids (no i18n in the lib). Drag to pan, wheel to zoom.
 */
export class GalleryScene extends Phaser.Scene {
  private cameraController: CameraController | null = null;

  constructor() {
    super({ key: GALLERY_SCENE_KEY });
  }

  create(): void {
    ensureTextures(this);
    this.cameras.main.setBackgroundColor('#0b1020');

    let y = 0;
    let maxX = 0;

    // Column headers.
    let maxLevels = 0;
    for (const faction of FACTION_IDS)
      for (const type of getFactionTowers(faction))
        maxLevels = Math.max(maxLevels, getTowerDef(type).levels.length);
    for (let level = 1; level <= maxLevels; level++) {
      TEAMS.forEach((team, t) => {
        const x = ROW_LABEL_W + ((level - 1) * TEAMS.length + t) * COL_W;
        this.label(x, y, `L${level} ${team}`);
        maxX = Math.max(maxX, x + COL_W / 2);
      });
    }
    y += 20;

    // Towers: faction blocks, one row per tower (role order), levels x teams in columns.
    for (const faction of FACTION_IDS) {
      this.add
        .text(0, y, faction, {
          ...TITLE_STYLE,
          color: getFactionDef(faction).color,
          resolution: this.textResolution(),
        })
        .setOrigin(0, 0);
      y += 24;
      for (const type of getFactionTowers(faction)) {
        const def = getTowerDef(type);
        const groundY = y + ROW_H - 26;
        this.label(0, groundY - 6, `${type}\n(${def.role})`, 0);
        for (let level = 1; level <= def.levels.length; level++) {
          TEAMS.forEach((team, t) => {
            const x = ROW_LABEL_W + ((level - 1) * TEAMS.length + t) * COL_W;
            const info = ensureTowerTexture(this, modelIdOf(type, level), team);
            this.add
              .image(x, groundY, groundTextureKey('grass-a'))
              .setScale(2 * D);
            this.add
              .image(x, groundY, info.key)
              .setScale(D)
              .setOrigin(info.displayOriginX, info.displayOriginY);
          });
        }
        y += ROW_H;
      }
      y += 10;
    }

    // Projectile visuals.
    y += 10;
    this.add
      .text(0, y, 'projectiles', {
        ...TITLE_STYLE,
        resolution: this.textResolution(),
      })
      .setOrigin(0, 0);
    y += 30;
    const perRow = 8;
    const projectileStep = 80;
    allProjectileVisualIds().forEach((visual, i) => {
      const x = 30 + (i % perRow) * projectileStep;
      const rowY = y + Math.floor(i / perRow) * 44;
      this.add
        .image(x, rowY, ensureProjectileTexture(this, visual))
        .setScale(2 * D);
      this.label(x, rowY + 14, visual);
      maxX = Math.max(maxX, x + projectileStep / 2);
    });
    y += Math.ceil(allProjectileVisualIds().length / perRow) * 44 + 10;

    // Ground tiles.
    const groundStep = 60;
    GROUND_KINDS.forEach((kind, i) => {
      const x = 30 + i * groundStep;
      this.add.image(x, y + 10, groundTextureKey(kind)).setScale(D);
      this.label(x, y + 24, kind);
    });
    y += 50;

    // Creep.
    this.add
      .image(30, y + 11, CREEP_SHADOW_KEY)
      .setScale(D)
      .setAlpha(0.35);
    this.add.image(30, y + 6, CREEP_BODY_KEY).setScale(D);
    this.label(30, y + 24, 'creep');
    y += 40;

    const bounds = { minX: -20, maxX: maxX + 20, minY: -10, maxY: y };
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

  private textResolution(): number {
    return getPixelRatio(this) * MAX_ZOOM;
  }

  private label(x: number, y: number, text: string, originX = 0.5): void {
    this.add
      .text(x, y, text, { ...LABEL_STYLE, resolution: this.textResolution() })
      .setOrigin(originX, 0);
  }
}

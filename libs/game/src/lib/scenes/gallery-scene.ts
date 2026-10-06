import * as Phaser from 'phaser';
import {
  FACTION_IDS,
  getFactionDef,
  getFactionTowers,
  getTowerDef,
} from '@td/shared';
import { getPixelRatio } from '../display.js';
import {
  allProjectileVisualIds,
  resolveProjectile,
} from '../visuals/projectile-registry.js';
import { CameraController, MAX_ZOOM } from './camera-controller.js';
import {
  GROUND_KINDS,
  applySpriteRef,
  atlasFrameNames,
  atlasRef,
  creepSkin,
  ensureProjectileTexture,
  ensureTextures,
  ensureTowerTexture,
  groundRef,
} from './textures.js';
import type { SpriteRef } from './textures.js';
import { installArt, queueArt } from './art-loader.js';
import { modelIdOf } from '../visuals/model-registry.js';
import { DEFAULT_ASSETS_BASE_URL } from '../visuals/atlas.js';
import { planGallery } from '../visuals/art-manifest.js';
import type { ArtManifest, ManifestFrame } from '../visuals/art-manifest.js';
import { CREEP_BODY_Y, CREEP_SHADOW_Y } from '../visuals/creep-motion.js';

export const GALLERY_SCENE_KEY = 'td-gallery';

export interface GallerySceneData {
  /** Base URL of the art atlas and manifest (default `/assets/`). */
  readonly assetsBaseUrl?: string;
}

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#cbd5e1',
};
/** Frame-name labels of the manifest gallery (long, so smaller). */
const FRAME_LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '7px',
  color: '#cbd5e1',
};
const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  fontStyle: 'bold',
  color: '#ffffff',
};
/** Mismatch between the manifest and the atlas. */
const ERROR_COLOR = '#f87171';
const ERROR_COLOR_HEX = 0xf87171;
const OK_COLOR = '#4ade80';

const TEAMS = ['blue', 'red'] as const;
/** Logical layout of the procedural tower grid. */
const ROW_LABEL_W = 170;
const COL_W = 74;
const ROW_H = 86;
/** Logical layout of the manifest gallery. */
const M_ROW_LABEL_W = 130;
const M_COL_W = 156;
const M_ROW_H = 140;
/** Walk animation speed of the gallery previews (frames per second; the game uses distance). */
const WALK_PREVIEW_FPS = 8;

interface Bounds {
  y: number;
  maxX: number;
}

/**
 * Asset gallery. With the art manifest: every manifest frame grouped (ground, creeps with an animated
 * walk cycle, towers by faction -> role -> level x team, projectiles, fx), labelled with its frame
 * name; frames missing from the atlas (or present in the atlas but not listed) are marked in red.
 * Without manifest: the procedural placeholders. Labels are data ids (no i18n in the lib). Drag to
 * pan, wheel to zoom.
 */
export class GalleryScene extends Phaser.Scene {
  private assetsBaseUrl = DEFAULT_ASSETS_BASE_URL;
  private cameraController: CameraController | null = null;
  /** Projectile previews that spin in flight (tornado, dust), animated in `update`. */
  private readonly spinners: {
    image: Phaser.GameObjects.Image;
    spin: number;
  }[] = [];
  /** Walk cycle previews, animated in `update`. */
  private readonly walkers: {
    image: Phaser.GameObjects.Image;
    frames: readonly SpriteRef[];
  }[] = [];

  constructor() {
    super({ key: GALLERY_SCENE_KEY });
  }

  init(data: GallerySceneData | undefined): void {
    this.assetsBaseUrl = data?.assetsBaseUrl ?? DEFAULT_ASSETS_BASE_URL;
  }

  preload(): void {
    queueArt(this, this.assetsBaseUrl, { manifest: true });
  }

  create(): void {
    const art = installArt(this);
    ensureTextures(this);
    this.cameras.main.setBackgroundColor('#0b1020');

    const b: Bounds = { y: 0, maxX: 0 };
    if (art.manifest) this.buildFromManifest(art.manifest, b);
    else this.buildProcedural(b);

    this.cameraController = new CameraController(this);
    // Full width, top first: a gallery taller than the screen opens on its top (pan to scroll).
    const fit = (): void => {
      const cam = this.cameras.main;
      const minX = -20;
      const maxX = b.maxX + 20;
      const minY = -10;
      const screenful = ((maxX - minX) * cam.height) / Math.max(1, cam.width);
      this.cameraController?.fit({
        minX,
        maxX,
        minY,
        maxY: Math.min(b.y, minY + screenful),
      });
    };
    fit();
    const onResize = (): void => {
      if (this.cameraController && !this.cameraController.userMoved) fit();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.cameraController?.destroy();
      this.cameraController = null;
      this.spinners.length = 0;
      this.walkers.length = 0;
    });
  }

  override update(time: number): void {
    for (const { image, spin } of this.spinners)
      image.setRotation((time / 1000) * spin);
    const step = Math.floor((time / 1000) * WALK_PREVIEW_FPS);
    for (const { image, frames } of this.walkers) {
      const ref = frames[step % frames.length];
      if (ref) image.setTexture(ref.key, ref.frame);
    }
  }

  // ---- Manifest gallery -------------------------------------------------------------------------

  private buildFromManifest(manifest: ArtManifest, b: Bounds): void {
    const plan = planGallery(manifest, atlasFrameNames(this));
    const missing = plan.missingFromAtlas;

    const total = manifest.frames.length;
    const ok = missing.size === 0 && plan.unlisted.length === 0;
    this.title(
      0,
      b.y,
      ok
        ? `art atlas: ${total} frames, manifest and atlas match`
        : `art atlas: ${total} frames, ${missing.size} missing from the atlas, ${plan.unlisted.length} not in the manifest`,
      ok ? OK_COLOR : ERROR_COLOR,
    );
    b.y += 30;

    // Ground tiles.
    this.title(0, b.y, 'ground');
    b.y += 30;
    this.frameRow(plan.ground, missing, b, 100, 1, 12);

    // Creeps: animated walk (rotated preview), each walk frame, shadow.
    if (plan.creeps.length > 0) {
      this.title(0, b.y, 'creeps');
      b.y += 34;
      for (const creep of plan.creeps) {
        const skin = creepSkin(this, creep.id);
        const x0 = 40;
        const y = b.y + 16;
        if (skin.walk) {
          applySpriteRef(
            this.add.image(x0, y + CREEP_SHADOW_Y * 2, skin.shadow.key),
            skin.shadow,
            2,
          ).setAlpha(skin.shadowAlpha);
          const image = applySpriteRef(
            this.add.image(x0, y + CREEP_BODY_Y * 2, skin.body.key),
            skin.body,
            2,
          );
          this.walkers.push({ image, frames: skin.walk });
          this.frameLabel(x0, y + 22, `creep/${creep.id} (walk)`);
        } else {
          this.frameLabel(
            x0,
            y + 22,
            `creep/${creep.id}: no walk cycle`,
            ERROR_COLOR,
          );
        }
        const frames = creep.shadow
          ? [...creep.walk, creep.shadow]
          : creep.walk;
        frames.forEach((frame, i) => {
          const x = x0 + 110 + i * 100;
          this.frameCell(x, y, frame, missing, 2);
          b.maxX = Math.max(b.maxX, x + 50);
        });
        b.y += 64;
      }
    }

    // Towers: faction blocks, one row per tower (role order), levels x teams in columns.
    if (plan.factions.length > 0) {
      this.title(0, b.y, 'towers');
      b.y += 30;
      let maxLevels = 0;
      for (const f of plan.factions)
        for (const row of f.rows)
          maxLevels = Math.max(maxLevels, row.cells.length);
      for (let level = 1; level <= maxLevels; level++) {
        plan.teams.forEach((team, t) => {
          const x =
            M_ROW_LABEL_W + ((level - 1) * plan.teams.length + t) * M_COL_W;
          this.label(x, b.y, `L${level} ${team}`);
          b.maxX = Math.max(b.maxX, x + M_COL_W / 2);
        });
      }
      b.y += 20;
      for (const { faction, rows } of plan.factions) {
        this.title(0, b.y, faction, getFactionDef(faction).color);
        b.y += 24;
        for (const row of rows) {
          const groundY = b.y + M_ROW_H - 34;
          this.label(0, groundY - 6, `${row.type}\n(${row.role})`, 0);
          row.cells.forEach((teams, l) => {
            teams.forEach((frame, t) => {
              if (!frame) return;
              const x = M_ROW_LABEL_W + (l * plan.teams.length + t) * M_COL_W;
              const tile = groundRef(this, 'grass-a');
              applySpriteRef(this.add.image(x, groundY, tile.key), tile, 2);
              this.frameCell(x, groundY, frame, missing, 1, 22);
            });
          });
          b.y += M_ROW_H;
        }
        b.y += 10;
      }
    }

    if (plan.projectiles.length > 0) {
      this.title(0, b.y, 'projectiles');
      b.y += 34;
      this.frameRow(plan.projectiles, missing, b, 110, 2, 20, 7);
    }
    if (plan.fx.length > 0) {
      this.title(0, b.y, 'fx');
      b.y += 30;
      this.frameRow(plan.fx, missing, b, 100, 2, 16);
    }
    if (plan.other.length > 0) {
      this.title(
        0,
        b.y,
        'other manifest frames (unknown name or model)',
        ERROR_COLOR,
      );
      b.y += 34;
      this.frameRow(plan.other, missing, b, 110, 1, 24, 7);
    }
    if (plan.unlisted.length > 0) {
      this.title(0, b.y, 'in the atlas but not in the manifest', ERROR_COLOR);
      b.y += 30;
      const perRow = 7;
      plan.unlisted.forEach((name, i) => {
        const x = 40 + (i % perRow) * 120;
        const y = b.y + 16 + Math.floor(i / perRow) * 60;
        const ref = atlasRef(this, name);
        if (ref) applySpriteRef(this.add.image(x, y, ref.key), ref);
        this.frameLabel(x, y + 24, name, ERROR_COLOR);
        b.maxX = Math.max(b.maxX, x + 60);
      });
      b.y += Math.ceil(plan.unlisted.length / perRow) * 60 + 10;
    }
  }

  /** Frames in rows of `perRow`, `step` px apart, at `scale` x their logical size. */
  private frameRow(
    frames: readonly ManifestFrame[],
    missing: ReadonlySet<string>,
    b: Bounds,
    step: number,
    scale: number,
    labelDy: number,
    perRow = 8,
  ): void {
    const rowH = labelDy + 34;
    frames.forEach((frame, i) => {
      const x = 40 + (i % perRow) * step;
      const y = b.y + Math.floor(i / perRow) * rowH;
      this.frameCell(x, y, frame, missing, scale, labelDy);
      b.maxX = Math.max(b.maxX, x + step / 2);
    });
    b.y += Math.ceil(frames.length / perRow) * rowH + 6;
  }

  /**
   * One manifest frame anchored (pivot) at (x, y): the atlas sprite, or a red box of its manifest
   * size when the atlas lacks it; frame name below.
   */
  private frameCell(
    x: number,
    y: number,
    frame: ManifestFrame,
    missing: ReadonlySet<string>,
    scale = 1,
    labelDy = 22,
  ): void {
    const ref = missing.has(frame.name) ? null : atlasRef(this, frame.name);
    if (ref) {
      applySpriteRef(this.add.image(x, y, ref.key), ref, scale);
    } else {
      const w = Math.max(4, frame.width * scale);
      const h = Math.max(4, frame.height * scale);
      this.add
        .rectangle(x - w * frame.pivot.x, y - h * frame.pivot.y, w, h)
        .setOrigin(0, 0)
        .setStrokeStyle(1, ERROR_COLOR_HEX, 1);
    }
    this.frameLabel(x, y + labelDy, frame.name, ref ? undefined : ERROR_COLOR);
  }

  // ---- Procedural gallery -----------------------------------------------------------------------

  private buildProcedural(b: Bounds): void {
    // Column headers.
    let maxLevels = 0;
    for (const faction of FACTION_IDS)
      for (const type of getFactionTowers(faction))
        maxLevels = Math.max(maxLevels, getTowerDef(type).levels.length);
    for (let level = 1; level <= maxLevels; level++) {
      TEAMS.forEach((team, t) => {
        const x = ROW_LABEL_W + ((level - 1) * TEAMS.length + t) * COL_W;
        this.label(x, b.y, `L${level} ${team}`);
        b.maxX = Math.max(b.maxX, x + COL_W / 2);
      });
    }
    b.y += 20;

    // Towers: faction blocks, one row per tower (role order), levels x teams in columns.
    const tile = groundRef(this, 'grass-a');
    for (const faction of FACTION_IDS) {
      this.title(0, b.y, faction, getFactionDef(faction).color);
      b.y += 24;
      for (const type of getFactionTowers(faction)) {
        const def = getTowerDef(type);
        const groundY = b.y + ROW_H - 26;
        this.label(0, groundY - 6, `${type}\n(${def.role})`, 0);
        for (let level = 1; level <= def.levels.length; level++) {
          TEAMS.forEach((team, t) => {
            const x = ROW_LABEL_W + ((level - 1) * TEAMS.length + t) * COL_W;
            const ref = ensureTowerTexture(this, modelIdOf(type, level), team);
            applySpriteRef(this.add.image(x, groundY, tile.key), tile, 2);
            applySpriteRef(this.add.image(x, groundY, ref.key), ref);
          });
        }
        b.y += ROW_H;
      }
      b.y += 10;
    }

    // Projectile visuals.
    b.y += 10;
    this.title(0, b.y, 'projectiles');
    b.y += 30;
    const perRow = 8;
    const projectileStep = 80;
    const visuals = allProjectileVisualIds();
    visuals.forEach((visual, i) => {
      const x = 30 + (i % perRow) * projectileStep;
      const rowY = b.y + Math.floor(i / perRow) * 44;
      const ref = ensureProjectileTexture(this, visual);
      const image = applySpriteRef(this.add.image(x, rowY, ref.key), ref, 2);
      const { spin } = resolveProjectile(visual);
      if (spin !== 0) this.spinners.push({ image, spin });
      this.label(x, rowY + 14, visual);
      b.maxX = Math.max(b.maxX, x + projectileStep / 2);
    });
    b.y += Math.ceil(visuals.length / perRow) * 44 + 10;

    // Ground tiles.
    const groundStep = 60;
    GROUND_KINDS.forEach((kind, i) => {
      const x = 30 + i * groundStep;
      const ref = groundRef(this, kind);
      applySpriteRef(this.add.image(x, b.y + 10, ref.key), ref);
      this.label(x, b.y + 24, kind);
    });
    b.y += 50;

    // Creep.
    const skin = creepSkin(this, 'beetle');
    applySpriteRef(
      this.add.image(
        30,
        b.y + 6 + CREEP_SHADOW_Y - CREEP_BODY_Y,
        skin.shadow.key,
      ),
      skin.shadow,
    ).setAlpha(skin.shadowAlpha);
    applySpriteRef(this.add.image(30, b.y + 6, skin.body.key), skin.body);
    this.label(30, b.y + 24, 'creep');
    b.y += 40;
  }

  // ---- Text -------------------------------------------------------------------------------------

  private textResolution(): number {
    return getPixelRatio(this) * MAX_ZOOM;
  }

  private title(x: number, y: number, text: string, color?: string): void {
    this.add
      .text(x, y, text, {
        ...TITLE_STYLE,
        ...(color ? { color } : {}),
        resolution: this.textResolution(),
      })
      .setOrigin(0, 0);
  }

  private label(x: number, y: number, text: string, originX = 0.5): void {
    this.add
      .text(x, y, text, { ...LABEL_STYLE, resolution: this.textResolution() })
      .setOrigin(originX, 0);
  }

  private frameLabel(x: number, y: number, text: string, color?: string): void {
    this.add
      .text(x, y, text, {
        ...FRAME_LABEL_STYLE,
        ...(color ? { color } : {}),
        resolution: this.textResolution(),
      })
      .setOrigin(0.5, 0);
  }
}

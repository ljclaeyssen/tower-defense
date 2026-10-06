import * as Phaser from 'phaser';
import { TOWER_FOOTPRINT, TOWER_TYPE_IDS, getTowerDef } from '@td/shared';
import type { Team, TowerTypeId } from '@td/shared';
import { TILE_H, TILE_W } from '../iso.js';
import { GROUND_KINDS } from '../ground.js';
import type { GroundKind } from '../ground.js';
import { nextPowerOfTwo } from '../render-math.js';

/**
 * Procedural placeholder art: every texture is drawn once with a Graphics object and baked with
 * `generateTexture` (Canvas API, so no gradients). Textures are global to the Phaser.Game.
 *
 * Textures are supersampled: drawn TEXTURE_SCALE times larger than their logical (world) size and
 * padded to power-of-two dimensions so WebGL can mipmap them. Every consumer displays them with
 * `setScale(TEXTURE_DISPLAY_SCALE)`; the content stays centered in the padded texture, so the default
 * 0.5 origin still points at the content center. All sizes below are logical (world px).
 */

/** Supersampling factor of the baked textures. */
export const TEXTURE_SCALE = 4;
/** Scale that displays a baked texture at its logical size. */
export const TEXTURE_DISPLAY_SCALE = 1 / TEXTURE_SCALE;

/** Physical (texture px) size of a baked texture and offset of its content inside it. */
function bakedLayout(
  width: number,
  height: number,
): {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
} {
  const w = Math.ceil(width * TEXTURE_SCALE);
  const h = Math.ceil(height * TEXTURE_SCALE);
  const pw = nextPowerOfTwo(w);
  const ph = nextPowerOfTwo(h);
  return {
    width: pw,
    height: ph,
    offsetX: (pw - w) / 2,
    offsetY: (ph - h) / 2,
  };
}

export { GROUND_KINDS } from '../ground.js';
export type { GroundKind } from '../ground.js';

export const groundTextureKey = (kind: GroundKind): string => `ground-${kind}`;
export const GROUND_FLASH_KEY = 'ground-flash';
export const CREEP_BODY_KEY = 'creep-body';
export const CREEP_SHADOW_KEY = 'creep-shadow';
export const PROJECTILE_KEY = 'projectile';
export const PARTICLE_KEY = 'particle';

export const TEAM_COLORS: Record<Team, number> = {
  blue: 0x3b82f6,
  red: 0xef4444,
};
export const CREEP_COLOR = 0x8a7a44;

const GROUND_COLORS: Record<GroundKind, number> = {
  'grass-a': 0x4a7c3a,
  'grass-b': 0x548a42,
  'path-a': 0x8a6a3f,
  'path-b': 0x7a5c36,
  rock: 0x5f646b,
  spawn: 0x3fae5a,
  exit: 0xb83b3b,
};
/** Darker edge of road tiles, so the route reads clearly against the grass. */
const PATH_OUTLINE = 0x3f2c17;
/** Cobble specks per road tone (logical tile coordinates: x, y, width, height). */
const PATH_SPECKS: Record<
  'path-a' | 'path-b',
  readonly (readonly [number, number, number, number])[]
> = {
  'path-a': [
    [11, 6, 4, 2],
    [20, 9, 5, 2],
    [15, 11, 3, 1.5],
  ],
  'path-b': [
    [13, 9, 5, 2],
    [19, 5, 3, 1.5],
    [9, 8, 3, 1.5],
  ],
};

/** Stone palette per tower type: top (lightest), left (lighter) and right (darker) faces. */
const TOWER_PALETTES: Partial<
  Record<TowerTypeId, { top: number; left: number; right: number }>
> = {
  archer: { top: 0xe2dccb, left: 0xb9b19a, right: 0x857d68 },
};
const DEFAULT_PALETTE = { top: 0xd4d4d8, left: 0xa1a1aa, right: 0x71717a };

/** Pixel height of the tower prism for a 1-based level. */
export const towerHeightPx = (level: number): number => 10 + 8 * level;

/** Half extents of the prism base, slightly inset in the 2x2 footprint diamond. */
const TOWER_HALF_W = (TILE_W * TOWER_FOOTPRINT) / 2 - 6;
const TOWER_HALF_H = TOWER_HALF_W / 2;

export interface TowerTextureInfo {
  readonly key: string;
  /** Logical size of the drawn prism area (for bounds, hit tests and occlusion). */
  readonly width: number;
  readonly height: number;
  /** Anchor (footprint center) as a ratio of the logical content area. */
  readonly originX: number;
  readonly originY: number;
  /** Anchor as a ratio of the padded baked texture: pass these to `setOrigin`. */
  readonly displayOriginX: number;
  readonly displayOriginY: number;
}

export function towerTexture(
  type: TowerTypeId,
  level: number,
  team: Team,
): TowerTextureInfo {
  const h = towerHeightPx(level);
  const width = TILE_W * TOWER_FOOTPRINT;
  const height = h + TILE_H * TOWER_FOOTPRINT;
  const anchorY = h + (TILE_H * TOWER_FOOTPRINT) / 2;
  const layout = bakedLayout(width, height);
  return {
    key: `tower-${type}-${level}-${team}`,
    width,
    height,
    originX: 0.5,
    originY: anchorY / height,
    displayOriginX:
      (layout.offsetX + (width / 2) * TEXTURE_SCALE) / layout.width,
    displayOriginY: (layout.offsetY + anchorY * TEXTURE_SCALE) / layout.height,
  };
}

/** Generates every texture the scenes need (no-op for textures that already exist). */
export function ensureTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);
  try {
    for (const kind of GROUND_KINDS) {
      bake(scene, g, groundTextureKey(kind), TILE_W, TILE_H, () =>
        drawGroundTile(g, kind),
      );
    }
    bake(scene, g, GROUND_FLASH_KEY, TILE_W, TILE_H, () => {
      diamondPath(g, TILE_W / 2, TILE_H / 2, TILE_W / 2, TILE_H / 2);
      g.fillStyle(0xffffff, 1).fillPath();
    });
    for (const type of TOWER_TYPE_IDS) {
      const levels = getTowerDef(type).levels.length;
      for (let level = 1; level <= levels; level++) {
        for (const team of ['blue', 'red'] as const) {
          const info = towerTexture(type, level, team);
          bake(scene, g, info.key, info.width, info.height, () =>
            drawTower(g, type, level, team),
          );
        }
      }
    }
    bake(scene, g, CREEP_BODY_KEY, 14, 11, () => {
      g.fillStyle(CREEP_COLOR, 1).fillEllipse(7, 5.5, 12, 9);
      g.fillStyle(0xffffff, 0.18).fillEllipse(6, 4, 6, 3);
      g.lineStyle(1, 0x2b2416, 1).strokeEllipse(7, 5.5, 12, 9);
    });
    bake(scene, g, CREEP_SHADOW_KEY, 14, 6, () => {
      g.fillStyle(0x000000, 1).fillEllipse(7, 3, 14, 6);
    });
    bake(scene, g, PROJECTILE_KEY, 6, 6, () => {
      g.fillStyle(0xfff3c4, 1).fillCircle(3, 3, 2.5);
    });
    bake(scene, g, PARTICLE_KEY, 4, 4, () => {
      g.fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
    });
  } finally {
    g.destroy();
  }
}

function bake(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  key: string,
  width: number,
  height: number,
  draw: () => void,
): void {
  if (scene.textures.exists(key)) return;
  const layout = bakedLayout(width, height);
  g.clear();
  // Canvas transform: coordinates and line widths below are logical, rasterized TEXTURE_SCALE x.
  g.translateCanvas(layout.offsetX, layout.offsetY);
  g.scaleCanvas(TEXTURE_SCALE, TEXTURE_SCALE);
  draw();
  g.generateTexture(key, layout.width, layout.height);
}

/** Adds a closed diamond path centered on (cx, cy) with the given half extents. */
export function diamondPath(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): void {
  g.beginPath();
  g.moveTo(cx, cy - hh);
  g.lineTo(cx + hw, cy);
  g.lineTo(cx, cy + hh);
  g.lineTo(cx - hw, cy);
  g.closePath();
}

function drawGroundTile(
  g: Phaser.GameObjects.Graphics,
  kind: GroundKind,
): void {
  const cx = TILE_W / 2;
  const cy = TILE_H / 2;
  diamondPath(g, cx, cy, TILE_W / 2, TILE_H / 2);
  g.fillStyle(GROUND_COLORS[kind], 1).fillPath();

  if (kind === 'path-a' || kind === 'path-b') {
    g.fillStyle(0x000000, 0.14);
    for (const [x, y, w, h] of PATH_SPECKS[kind]) g.fillEllipse(x, y, w, h);
    g.fillStyle(0xffffff, 0.08).fillEllipse(cx - 2, cy - 1, 6, 2);
    diamondPath(g, cx, cy, TILE_W / 2 - 0.5, TILE_H / 2 - 0.5);
    g.lineStyle(1, PATH_OUTLINE, 0.5).strokePath();
    return;
  }
  if (kind === 'rock') {
    // A small boulder sitting on the grey tile: shadow, body, highlight, outline.
    g.fillStyle(0x000000, 0.25).fillEllipse(cx + 1, cy + 2.5, 14, 5);
    g.fillStyle(0x41454b, 1).fillEllipse(cx, cy, 12, 8);
    g.fillStyle(0x8a9098, 0.6).fillEllipse(cx - 2, cy - 2, 5, 2.5);
    g.lineStyle(0.75, 0x2a2d31, 1).strokeEllipse(cx, cy, 12, 8);
  }
  diamondPath(g, cx, cy, TILE_W / 2 - 0.5, TILE_H / 2 - 0.5);
  g.lineStyle(1, 0x000000, 0.18).strokePath();
}

function polygon(
  g: Phaser.GameObjects.Graphics,
  color: number,
  points: readonly (readonly [number, number])[],
): void {
  const first = points[0];
  if (!first) return;
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p) g.lineTo(p[0], p[1]);
  }
  g.closePath();
  g.fillPath();
}

function drawTower(
  g: Phaser.GameObjects.Graphics,
  type: TowerTypeId,
  level: number,
  team: Team,
): void {
  const palette = TOWER_PALETTES[type] ?? DEFAULT_PALETTE;
  const info = towerTexture(type, level, team);
  const h = towerHeightPx(level);
  const hw = TOWER_HALF_W;
  const hh = TOWER_HALF_H;
  const cx = info.width / 2;
  const cy = info.height * info.originY; // footprint center (ground)
  const ty = cy - h; // center of the top face

  // Left face (lighter), right face (darker), top (lightest).
  polygon(g, palette.left, [
    [cx - hw, ty],
    [cx, ty + hh],
    [cx, cy + hh],
    [cx - hw, cy],
  ]);
  polygon(g, palette.right, [
    [cx, ty + hh],
    [cx + hw, ty],
    [cx + hw, cy],
    [cx, cy + hh],
  ]);
  polygon(g, palette.top, [
    [cx, ty - hh],
    [cx + hw, ty],
    [cx, ty + hh],
    [cx - hw, ty],
  ]);

  // Masonry lines on the side faces, one per level.
  g.lineStyle(1, 0x000000, 0.15);
  for (let i = 1; i <= level; i++) {
    const y = cy - (h * i) / (level + 1);
    g.lineBetween(cx - hw, y, cx, y + hh);
    g.lineBetween(cx, y + hh, cx + hw, y);
  }

  // Team accent: an inner diamond on the top, larger with the level.
  const accent = 0.35 + 0.1 * level;
  diamondPath(g, cx, ty, hw * accent, hh * accent);
  g.fillStyle(TEAM_COLORS[team], 1).fillPath();

  // Edges.
  g.lineStyle(1, 0x1f1b14, 0.6);
  diamondPath(g, cx, ty, hw, hh);
  g.strokePath();
  g.lineBetween(cx - hw, ty, cx - hw, cy);
  g.lineBetween(cx + hw, ty, cx + hw, cy);
  g.lineBetween(cx, ty + hh, cx, cy + hh);
  g.lineBetween(cx - hw, cy, cx, cy + hh);
  g.lineBetween(cx, cy + hh, cx + hw, cy);
}

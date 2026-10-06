import * as Phaser from 'phaser';
import { TOWER_FOOTPRINT, TOWER_TYPE_IDS, getTowerDef } from '@td/shared';
import type { Team, TowerTypeId } from '@td/shared';
import { TILE_H, TILE_W } from '../iso.js';

/**
 * Procedural placeholder art: every texture is drawn once with a Graphics object and baked with
 * `generateTexture` (Canvas API, so no gradients). Textures are global to the Phaser.Game.
 */

export const GROUND_KINDS = [
  'grass-a',
  'grass-b',
  'blocked',
  'spawn',
  'exit',
] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];

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
  blocked: 0x3a3f47,
  spawn: 0x3fae5a,
  exit: 0xb83b3b,
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
  readonly width: number;
  readonly height: number;
  /** Origin that puts the footprint center (the anchor) at the sprite position. */
  readonly originX: number;
  readonly originY: number;
}

export function towerTexture(
  type: TowerTypeId,
  level: number,
  team: Team,
): TowerTextureInfo {
  const h = towerHeightPx(level);
  const width = TILE_W * TOWER_FOOTPRINT;
  const height = h + TILE_H * TOWER_FOOTPRINT;
  return {
    key: `tower-${type}-${level}-${team}`,
    width,
    height,
    originX: 0.5,
    originY: (h + (TILE_H * TOWER_FOOTPRINT) / 2) / height,
  };
}

/** Generates every texture the scenes need (no-op for textures that already exist). */
export function ensureTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);
  try {
    for (const kind of GROUND_KINDS) {
      bake(scene, g, groundTextureKey(kind), TILE_W, TILE_H, () =>
        drawGroundTile(g, GROUND_COLORS[kind]),
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
  g.clear();
  draw();
  g.generateTexture(key, width, height);
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

function drawGroundTile(g: Phaser.GameObjects.Graphics, color: number): void {
  diamondPath(g, TILE_W / 2, TILE_H / 2, TILE_W / 2, TILE_H / 2);
  g.fillStyle(color, 1).fillPath();
  diamondPath(g, TILE_W / 2, TILE_H / 2, TILE_W / 2 - 0.5, TILE_H / 2 - 0.5);
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

import * as Phaser from 'phaser';
import { TOWER_FOOTPRINT } from '@td/shared';
import type { Team } from '@td/shared';
import { TILE_H, TILE_W } from '../iso.js';
import { GROUND_KINDS } from '../ground.js';
import type { GroundKind } from '../ground.js';
import { mixColor, nextPowerOfTwo } from '../render-math.js';
import {
  ATLAS_KEY,
  CREEP_WALK_FRAMES,
  GROUND_FLASH_FRAME,
  PARTICLE_FRAME,
  creepShadowFrameName,
  creepWalkFrameName,
  groundFrameName,
  spriteRefFromFrame,
} from '../visuals/atlas.js';
import type { SpriteRef } from '../visuals/atlas.js';
import { resolveModel, towerFrameName } from '../visuals/model-registry.js';
import type { ModelDescriptor } from '../visuals/model-registry.js';
import {
  projectileFrameName,
  resolveProjectile,
} from '../visuals/projectile-registry.js';

/**
 * Sprite resolution. Every lookup below returns a {@link SpriteRef}: the atlas frame (texture
 * `ATLAS_KEY`, displayed at `ATLAS_DISPLAY_SCALE`) when the loaded atlas has it, else a procedural
 * placeholder.
 *
 * Procedural placeholders are drawn once with a Graphics object and baked with `generateTexture`
 * (Canvas API, so no gradients). Textures are global to the Phaser.Game. They are supersampled: drawn
 * TEXTURE_SCALE times larger than their logical (world) size and padded to power-of-two dimensions so
 * WebGL can mipmap them; a {@link BAKED_FRAME} frame cuts the content out of the padding, so a baked
 * texture is used exactly like an atlas frame. All sizes below are logical (world px).
 */

export type { SpriteRef } from '../visuals/atlas.js';
export { ATLAS_KEY } from '../visuals/atlas.js';

/** Supersampling factor of the baked textures. */
export const TEXTURE_SCALE = 4;
/** Scale that displays a baked texture at its logical size. */
export const TEXTURE_DISPLAY_SCALE = 1 / TEXTURE_SCALE;
/** Frame of a baked texture that covers its content (without the power-of-two padding). */
export const BAKED_FRAME = 'content';

/** Physical (texture px) size of a baked texture, of its content, and offset of the content inside it. */
function bakedLayout(
  width: number,
  height: number,
): {
  readonly width: number;
  readonly height: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
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
    contentWidth: w,
    contentHeight: h,
    offsetX: (pw - w) / 2,
    offsetY: (ph - h) / 2,
  };
}

/** SpriteRef of a baked texture of logical size width x height anchored at (originX, originY). */
function bakedRef(
  key: string,
  width: number,
  height: number,
  originX = 0.5,
  originY = 0.5,
): SpriteRef {
  return {
    key,
    frame: BAKED_FRAME,
    displayScale: TEXTURE_DISPLAY_SCALE,
    width,
    height,
    originX,
    originY,
  };
}

/** SpriteRef of `frameName` in the loaded atlas, or null when there is no atlas or no such frame. */
export function atlasRef(
  scene: Phaser.Scene,
  frameName: string,
): SpriteRef | null {
  const textures = scene.textures;
  if (!textures.exists(ATLAS_KEY)) return null;
  const texture = textures.get(ATLAS_KEY);
  if (!texture.has(frameName)) return null;
  const frame = texture.get(frameName);
  return spriteRefFromFrame(ATLAS_KEY, frameName, {
    sourceW: frame.realWidth,
    sourceH: frame.realHeight,
    pivotX: frame.customPivot ? frame.pivotX : 0.5,
    pivotY: frame.customPivot ? frame.pivotY : 0.5,
  });
}

/** Frame names of the loaded atlas (empty without atlas). */
export function atlasFrameNames(scene: Phaser.Scene): string[] {
  if (!scene.textures.exists(ATLAS_KEY)) return [];
  return scene.textures
    .get(ATLAS_KEY)
    .getFrameNames(false)
    .filter((n) => n !== '__BASE');
}

export { GROUND_KINDS } from '../ground.js';
export type { GroundKind } from '../ground.js';

export const groundTextureKey = (kind: GroundKind): string => `ground-${kind}`;
export const GROUND_FLASH_KEY = 'ground-flash';
export const CREEP_BODY_KEY = 'creep-body';
export const CREEP_SHADOW_KEY = 'creep-shadow';
export const PARTICLE_KEY = 'particle';

/** Logical sizes of the shared procedural textures. */
const CREEP_BODY_SIZE = { width: 14, height: 11 } as const;
const CREEP_SHADOW_SIZE = { width: 14, height: 6 } as const;
/** Logical diameter of particles; atlas particles are scaled to it (callers think in particles). */
export const PARTICLE_SIZE = 4;

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

/** Half extents of the prism base, slightly inset in the 2x2 footprint diamond. */
const TOWER_HALF_W = (TILE_W * TOWER_FOOTPRINT) / 2 - 6;
/** Free space above the top face center in tower textures (orbs, crystals). */
const TOWER_HEADROOM = TILE_H;

export const towerTextureKey = (modelId: string, team: Team): string =>
  `tower-${modelId}-${team}`;
export const projectileTextureKey = (visualId: string): string =>
  `projectile-${visualId}`;

/** Procedural tower sprite of `modelId` (the texture itself is baked by `ensureTowerTexture`). */
export function towerTexture(modelId: string, team: Team): SpriteRef {
  const h = resolveModel(modelId).heightPx;
  const width = TILE_W * TOWER_FOOTPRINT;
  const anchorY = TOWER_HEADROOM + h;
  const height = anchorY + (TILE_H * TOWER_FOOTPRINT) / 2;
  return bakedRef(
    towerTextureKey(modelId, team),
    width,
    height,
    0.5,
    anchorY / height,
  );
}

/**
 * Sprite of the tower model `modelId` in `team` colours, anchored at the footprint center: the atlas
 * frame `tower/<modelId>/<team>` when present, else the procedural model (baked on first use).
 */
export function ensureTowerTexture(
  scene: Phaser.Scene,
  modelId: string,
  team: Team,
): SpriteRef {
  const fromAtlas = atlasRef(scene, towerFrameName(modelId, team));
  if (fromAtlas) return fromAtlas;
  const ref = towerTexture(modelId, team);
  if (!scene.textures.exists(ref.key)) {
    withGraphics(scene, (g) =>
      bake(scene, g, ref.key, ref.width, ref.height, () =>
        drawTower(g, resolveModel(modelId), ref, team),
      ),
    );
  }
  return ref;
}

/** Logical size of projectile textures (square, centered on the projectile). */
const PROJECTILE_SIZE = 12;

/**
 * Sprite of the projectile visual `visualId`, centered: the atlas frame `projectile/<visualId>` when
 * present, else the procedural shape (baked on first use).
 */
export function ensureProjectileTexture(
  scene: Phaser.Scene,
  visualId: string,
): SpriteRef {
  const fromAtlas = atlasRef(scene, projectileFrameName(visualId));
  if (fromAtlas) return fromAtlas;
  const key = projectileTextureKey(visualId);
  if (!scene.textures.exists(key)) {
    withGraphics(scene, (g) =>
      bake(scene, g, key, PROJECTILE_SIZE, PROJECTILE_SIZE, () =>
        drawProjectile(g, visualId),
      ),
    );
  }
  return bakedRef(key, PROJECTILE_SIZE, PROJECTILE_SIZE);
}

/** Ground tile of `kind`, anchored at the diamond center (requires `ensureTextures`). */
export function groundRef(scene: Phaser.Scene, kind: GroundKind): SpriteRef {
  return (
    atlasRef(scene, groundFrameName(kind)) ??
    bakedRef(groundTextureKey(kind), TILE_W, TILE_H)
  );
}

/** White tile diamond flashed over the exit (requires `ensureTextures`). */
export function groundFlashRef(scene: Phaser.Scene): SpriteRef {
  return (
    atlasRef(scene, GROUND_FLASH_FRAME) ??
    bakedRef(GROUND_FLASH_KEY, TILE_W, TILE_H)
  );
}

/** White round particle, meant to be tinted (requires `ensureTextures`). */
export function particleRef(scene: Phaser.Scene): SpriteRef {
  return (
    atlasRef(scene, PARTICLE_FRAME) ??
    bakedRef(PARTICLE_KEY, PARTICLE_SIZE, PARTICLE_SIZE)
  );
}

/** Sprites of a creep type. */
export interface CreepSkin {
  /** Walk cycle seen from above facing +x (rotated and flattened in the ground plane), or null. */
  readonly walk: readonly SpriteRef[] | null;
  /** Body shown when there is no walk cycle (an upright iso blob, never rotated); else walk[0]. */
  readonly body: SpriteRef;
  readonly shadow: SpriteRef;
  /** Alpha of the shadow sprite (the procedural shadow is opaque black). */
  readonly shadowAlpha: number;
}

/**
 * Sprites of creep `creepId`: the atlas walk cycle `creep/<id>/walk/0..3` (all frames required) and
 * shadow `creep/<id>/shadow` when present, else the procedural blob and shadow (requires
 * `ensureTextures`).
 */
export function creepSkin(scene: Phaser.Scene, creepId: string): CreepSkin {
  const walk: SpriteRef[] = [];
  for (let n = 0; n < CREEP_WALK_FRAMES; n++) {
    const ref = atlasRef(scene, creepWalkFrameName(creepId, n));
    if (!ref) break;
    walk.push(ref);
  }
  const first = walk.length === CREEP_WALK_FRAMES ? walk[0] : undefined;
  const shadow = atlasRef(scene, creepShadowFrameName(creepId));
  return {
    walk: first ? walk : null,
    body:
      first ??
      bakedRef(CREEP_BODY_KEY, CREEP_BODY_SIZE.width, CREEP_BODY_SIZE.height),
    shadow:
      shadow ??
      bakedRef(
        CREEP_SHADOW_KEY,
        CREEP_SHADOW_SIZE.width,
        CREEP_SHADOW_SIZE.height,
      ),
    shadowAlpha: shadow ? 1 : 0.35,
  };
}

/** Image-like game object that can display a SpriteRef. */
type SpriteTarget = Phaser.GameObjects.Components.Texture &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.Origin;

/** Shows `ref` on `image`: texture + frame, display scale (x `scaleFactor`) and origin. */
export function applySpriteRef<T extends SpriteTarget>(
  image: T,
  ref: SpriteRef,
  scaleFactor = 1,
): T {
  image.setTexture(ref.key, ref.frame);
  image.setScale(ref.displayScale * scaleFactor);
  image.setOrigin(ref.originX, ref.originY);
  return image;
}

function withGraphics(
  scene: Phaser.Scene,
  fn: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.make.graphics({}, false);
  try {
    fn(g);
  } finally {
    g.destroy();
  }
}

/**
 * Generates the shared procedural textures (ground, creeps, particles), used whenever the atlas lacks
 * a frame. Towers and projectiles are baked lazily by `ensureTowerTexture` / `ensureProjectileTexture`.
 * No-op for textures that already exist.
 */
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
    const body = CREEP_BODY_SIZE;
    bake(scene, g, CREEP_BODY_KEY, body.width, body.height, () => {
      g.fillStyle(CREEP_COLOR, 1).fillEllipse(7, 5.5, 12, 9);
      g.fillStyle(0xffffff, 0.18).fillEllipse(6, 4, 6, 3);
      g.lineStyle(1, 0x2b2416, 1).strokeEllipse(7, 5.5, 12, 9);
    });
    const shadow = CREEP_SHADOW_SIZE;
    bake(scene, g, CREEP_SHADOW_KEY, shadow.width, shadow.height, () => {
      g.fillStyle(0x000000, 1).fillEllipse(7, 3, 14, 6);
    });
    bake(scene, g, PARTICLE_KEY, PARTICLE_SIZE, PARTICLE_SIZE, () => {
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
  scene.textures
    .get(key)
    .add(
      BAKED_FRAME,
      0,
      layout.offsetX,
      layout.offsetY,
      layout.contentWidth,
      layout.contentHeight,
    );
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

type Point = readonly [number, number];

function drawTower(
  g: Phaser.GameObjects.Graphics,
  model: ModelDescriptor,
  info: SpriteRef,
  team: Team,
): void {
  const cx = info.width * info.originX;
  const cy = info.height * info.originY; // footprint center (ground)
  switch (model.shape) {
    case 'spire':
      drawSpire(g, model, cx, cy, team);
      break;
    case 'crystal':
      drawCrystal(g, model, cx, cy, team);
      break;
    case 'mortar':
      drawMortar(g, model, cx, cy, team);
      break;
    default:
      drawPrism(g, model, cx, cy, team);
      break;
  }
}

/**
 * Iso block, optionally tapered: base diamond of half extents (hw, hw / 2) on the ground at (cx, cy),
 * top diamond scaled by `taper` at height h. Left face lit, right face shaded, top lightest.
 * Returns the top face center y and half extents.
 */
function block(
  g: Phaser.GameObjects.Graphics,
  model: ModelDescriptor,
  cx: number,
  cy: number,
  hw: number,
  h: number,
  taper = 1,
): { ty: number; tw: number; th: number } {
  const { palette } = model;
  const hh = hw / 2;
  const tw = hw * taper;
  const th = hh * taper;
  const ty = cy - h;
  polygon(g, palette.left, [
    [cx - tw, ty],
    [cx, ty + th],
    [cx, cy + hh],
    [cx - hw, cy],
  ]);
  polygon(g, palette.right, [
    [cx, ty + th],
    [cx + tw, ty],
    [cx + hw, cy],
    [cx, cy + hh],
  ]);
  polygon(g, palette.top, [
    [cx, ty - th],
    [cx + tw, ty],
    [cx, ty + th],
    [cx - tw, ty],
  ]);
  g.lineStyle(1, 0x1f1b14, 0.55);
  diamondPath(g, cx, ty, tw, th);
  g.strokePath();
  g.lineBetween(cx - tw, ty, cx - hw, cy);
  g.lineBetween(cx + tw, ty, cx + hw, cy);
  g.lineBetween(cx, ty + th, cx, cy + hh);
  g.lineBetween(cx - hw, cy, cx, cy + hh);
  g.lineBetween(cx, cy + hh, cx + hw, cy);
  return { ty, tw, th };
}

/** Team colour as a thin band around the side faces, just below the top (faction palette dominates). */
function teamBand(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  ty: number,
  tw: number,
  th: number,
  team: Team,
): void {
  const y0 = ty + 2;
  const y1 = ty + 4;
  const faces: Point[][] = [
    [
      [cx - tw, y0],
      [cx, y0 + th],
      [cx, y1 + th],
      [cx - tw, y1],
    ],
    [
      [cx, y0 + th],
      [cx + tw, y0],
      [cx + tw, y1],
      [cx, y1 + th],
    ],
  ];
  for (const face of faces) polygon(g, TEAM_COLORS[team], face);
}

function drawPrism(
  g: Phaser.GameObjects.Graphics,
  model: ModelDescriptor,
  cx: number,
  cy: number,
  team: Team,
): void {
  const h = model.heightPx;
  const hw = TOWER_HALF_W;
  const { ty, tw, th } = block(g, model, cx, cy, hw, h);
  // Masonry courses.
  g.lineStyle(1, 0x000000, 0.15);
  const courses = Math.max(1, Math.round(h / 10));
  for (let i = 1; i <= courses; i++) {
    const y = cy - (h * i) / (courses + 1);
    g.lineBetween(cx - hw, y, cx, y + hw / 2);
    g.lineBetween(cx, y + hw / 2, cx + hw, y);
  }
  teamBand(g, cx, ty, tw, th, team);
  // Faction inlay on the roof.
  diamondPath(g, cx, ty, tw * 0.45, th * 0.45);
  g.fillStyle(model.palette.accent, 1).fillPath();
}

function drawSpire(
  g: Phaser.GameObjects.Graphics,
  model: ModelDescriptor,
  cx: number,
  cy: number,
  team: Team,
): void {
  const { ty, tw, th } = block(
    g,
    model,
    cx,
    cy,
    TOWER_HALF_W - 8,
    model.heightPx,
    0.55,
  );
  teamBand(g, cx, ty, tw, th, team);
  // Glowing orb in the faction accent.
  const oy = ty - 7;
  g.fillStyle(model.palette.accent, 0.3).fillCircle(cx, oy, 6);
  g.fillStyle(model.palette.accent, 1).fillCircle(cx, oy, 4);
  g.fillStyle(0xffffff, 0.75).fillCircle(cx - 1.2, oy - 1.2, 1.5);
}

function drawCrystal(
  g: Phaser.GameObjects.Graphics,
  model: ModelDescriptor,
  cx: number,
  cy: number,
  team: Team,
): void {
  const { ty, tw, th } = block(
    g,
    model,
    cx,
    cy,
    TOWER_HALF_W - 3,
    model.heightPx,
  );
  teamBand(g, cx, ty, tw, th, team);
  // Faceted ice crystal, slightly tinted by the faction palette.
  const ice = mixColor(0xbfe8ff, model.palette.top, 0.25);
  const iceDark = mixColor(0x5aa9e0, model.palette.right, 0.25);
  const top = ty - 15;
  const mid = ty - 4;
  const w = 7;
  polygon(g, ice, [
    [cx, top],
    [cx, ty + 3],
    [cx - w, mid],
  ]);
  polygon(g, iceDark, [
    [cx, top],
    [cx + w, mid],
    [cx, ty + 3],
  ]);
  g.lineStyle(0.75, 0x1d4e73, 0.8);
  g.beginPath();
  g.moveTo(cx, top);
  g.lineTo(cx + w, mid);
  g.lineTo(cx, ty + 3);
  g.lineTo(cx - w, mid);
  g.closePath();
  g.strokePath();
  g.fillStyle(0xffffff, 0.7).fillCircle(cx - 2, mid - 3, 1);
}

function drawMortar(
  g: Phaser.GameObjects.Graphics,
  model: ModelDescriptor,
  cx: number,
  cy: number,
  team: Team,
): void {
  const { ty, tw, th } = block(
    g,
    model,
    cx,
    cy,
    TOWER_HALF_W + 2,
    model.heightPx,
  );
  teamBand(g, cx, ty, tw, th, team);
  // Barrel: dark iso circle with an accent rim.
  g.fillStyle(model.palette.accent, 1).fillEllipse(cx, ty, 20, 10);
  g.fillStyle(0x2a2724, 1).fillEllipse(cx, ty, 16, 8);
  g.fillStyle(0x0e0d0c, 1).fillEllipse(cx, ty + 0.5, 10, 5);
  g.lineStyle(0.75, 0x000000, 0.6).strokeEllipse(cx, ty, 20, 10);
}

function drawProjectile(
  g: Phaser.GameObjects.Graphics,
  visualId: string,
): void {
  const { shape, color, radiusPx: r } = resolveProjectile(visualId);
  const c = PROJECTILE_SIZE / 2;
  switch (shape) {
    case 'arrow':
      // Points to +x; the scene rotates it along the flight direction.
      g.fillStyle(color, 1).fillRect(c - r, c - 0.5, r * 2 - 1.5, 1);
      polygon(g, color, [
        [c + r, c],
        [c + r - 2.5, c - 1.5],
        [c + r - 2.5, c + 1.5],
      ]);
      g.fillStyle(0xffffff, 0.8).fillRect(c - r, c - 1.2, 1.5, 2.4);
      break;
    case 'swirl':
      g.fillStyle(color, 0.25).fillCircle(c, c, r + 1.5);
      g.lineStyle(1, color, 1).strokeCircle(c, c, r);
      g.fillStyle(0xffffff, 1).fillCircle(c, c, r * 0.4);
      break;
    case 'bolt': {
      // Jagged spark pointing to +x (rotated along the flight): faint glow, then a bright core.
      const zig: Point[] = [
        [c - r, c + 0.5],
        [c - r * 0.4, c - 1.5],
        [c, c + 1.2],
        [c + r * 0.45, c - 1.2],
        [c + r, c],
      ];
      const stroke = (width: number, colour: number, alpha: number): void => {
        g.lineStyle(width, colour, alpha);
        g.beginPath();
        zig.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
        g.strokePath();
      };
      stroke(3, color, 0.35);
      stroke(1.4, color, 1);
      stroke(0.6, 0xffffff, 1);
      break;
    }
    case 'tornado':
      // Grey-white funnel: soft disc and three spiral arms (spins in flight).
      g.fillStyle(color, 0.25).fillCircle(c, c, r + 0.5);
      spiralArms(g, c, c, r, 3, 1, color, 1);
      g.fillStyle(0xffffff, 0.9).fillCircle(c, c, 0.9);
      break;
    case 'dust':
      // Dust devil: dense brown swirl around a darker core.
      g.fillStyle(color, 0.45).fillCircle(c, c, r + 0.5);
      spiralArms(g, c, c, r, 5, 1.1, mixColor(color, 0xffffff, 0.25), 0.95);
      g.fillStyle(mixColor(color, 0x000000, 0.45), 1).fillCircle(c, c, r * 0.4);
      break;
    case 'gust': {
      // Pale crescent wind blade pointing to +x, with tiny leaf dots trailing behind.
      g.fillStyle(color, 1);
      g.beginPath();
      g.arc(c - 1.5, c, r, -1.15, 1.15, false);
      g.arc(c - 3, c, r * 0.8, 1.05, -1.05, true);
      g.closePath();
      g.fillPath();
      g.fillStyle(mixColor(color, 0x2f8f3a, 0.6), 1);
      g.fillEllipse(c - r + 0.5, c - 2, 1.6, 1);
      g.fillEllipse(c - r - 0.5, c + 1.5, 1.4, 0.9);
      g.fillEllipse(c - r + 1.5, c + 3, 1.2, 0.8);
      break;
    }
    case 'wail':
      // Translucent "scream" ring with a skull-like face.
      g.fillStyle(color, 0.22).fillCircle(c, c, r);
      g.lineStyle(1, color, 0.85).strokeCircle(c, c, r);
      g.fillStyle(mixColor(color, 0x2a1b3d, 0.7), 0.9);
      g.fillCircle(c - 1.4, c - 0.8, 0.8);
      g.fillCircle(c + 1.4, c - 0.8, 0.8);
      g.fillEllipse(c, c + 1.6, 1.2, 1.6);
      break;
    case 'shard':
      diamondPath(g, c, c, r * 0.7, r * 1.3);
      g.fillStyle(color, 1).fillPath();
      g.lineStyle(0.5, 0xffffff, 0.9).strokePath();
      break;
    default:
      g.fillStyle(color, 1).fillCircle(c, c, r);
      g.fillStyle(0xffffff, 0.35).fillCircle(
        c - r * 0.35,
        c - r * 0.35,
        r * 0.4,
      );
      g.lineStyle(0.5, 0x000000, 0.6).strokeCircle(c, c, r);
      break;
  }
}

/** `arms` spiral arms around (cx, cy) growing to radius r, as stroked polylines. */
function spiralArms(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  arms: number,
  width: number,
  color: number,
  alpha: number,
): void {
  const steps = 8;
  const sweep = 2.4;
  g.lineStyle(width, color, alpha);
  for (let a = 0; a < arms; a++) {
    const a0 = (a / arms) * Math.PI * 2;
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = a0 + t * sweep;
      const rad = 0.6 + t * (r - 0.6);
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }
}

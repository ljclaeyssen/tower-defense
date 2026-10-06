/**
 * Creep animation math (pure, no Phaser): walk cycle driven by distance travelled, facing angle in the
 * ground plane, and the screen extents used for occlusion.
 */
import { TILE_H, TILE_W, gridToScreen } from '../iso.js';
import { CREEP_WALK_FRAMES } from './atlas.js';

/** Distance (cells) travelled per walk frame. */
export const WALK_CELLS_PER_FRAME = 0.25;

/** Walk-cycle frame for a total distance travelled (cells). */
export function walkFrameIndex(
  distance: number,
  frames: number = CREEP_WALK_FRAMES,
): number {
  if (frames <= 0) return 0;
  return Math.floor(distance / WALK_CELLS_PER_FRAME) % frames;
}

/** Per-creep odometer fed with interpolated grid positions. */
export interface WalkState {
  started: boolean;
  x: number;
  y: number;
  /** Total distance travelled, in cells. */
  distance: number;
}

export const createWalkState = (): WalkState => ({
  started: false,
  x: 0,
  y: 0,
  distance: 0,
});

/**
 * Adds the distance from the previous rendered grid position to (x, y) and returns the walk frame.
 * Deterministic from positions only: a creep that stands still (or a paused game) keeps its frame.
 */
export function advanceWalk(
  walk: WalkState,
  x: number,
  y: number,
  frames: number = CREEP_WALK_FRAMES,
): number {
  if (walk.started) walk.distance += Math.hypot(x - walk.x, y - walk.y);
  walk.started = true;
  walk.x = x;
  walk.y = y;
  return walkFrameIndex(walk.distance, frames);
}

const tmp = { x: 0, y: 0 };
/** Ground plane vertical stretch that undoes the iso squash (2 for a 2:1 projection). */
const UNSQUASH = TILE_W / TILE_H;
/** Vertical scale of flat ground sprites (the iso squash). */
export const FLAT_SCALE_Y = TILE_H / TILE_W;

/** Screen-space angle of a grid direction (the projected heading), or null for a zero vector. */
export function screenAngle(dx: number, dy: number): number | null {
  const s = gridToScreen(dx, dy, tmp);
  if (s.x === 0 && s.y === 0) return null;
  return Math.atan2(s.y, s.x);
}

/**
 * Rotation of a top-down sprite (facing +x) moving along grid direction (dx, dy), in the ground
 * plane: the projected direction with the iso squash undone. Rotating by this angle then scaling the
 * result by {@link FLAT_SCALE_Y} vertically (flat-object rule) heads exactly along the screen
 * direction and foreshortens the creature like the ground under it. Null for a zero vector.
 */
export function groundAngle(dx: number, dy: number): number | null {
  const s = gridToScreen(dx, dy, tmp);
  if (s.x === 0 && s.y === 0) return null;
  return Math.atan2(s.y * UNSQUASH, s.x);
}

/** Screen offsets of the creep parts relative to its ground position. */
export const CREEP_BODY_Y = -4;
export const CREEP_SHADOW_Y = 1;
export const CREEP_HP_BAR_Y = -12;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Screen extents (relative to the ground position) of a creep, for occlusion tests. */
export interface CreepExtents {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Extents of a creep made of `body` (logical size; `flat` = rotated in the ground plane and squashed,
 * so its footprint is bounded by a circle of its half size), `shadow`, and the HP bar above.
 */
export function creepExtents(
  body: Size,
  shadow: Size,
  flat: boolean,
): CreepExtents {
  const radius = Math.max(body.width, body.height) / 2;
  const halfW = flat ? radius : body.width / 2;
  const halfH = flat ? radius * FLAT_SCALE_Y : body.height / 2;
  const half = Math.max(halfW, shadow.width / 2);
  return {
    left: -half,
    right: half,
    top: Math.min(CREEP_BODY_Y - halfH, CREEP_HP_BAR_Y - 1),
    bottom: Math.max(CREEP_BODY_Y + halfH, CREEP_SHADOW_Y + shadow.height / 2),
  };
}

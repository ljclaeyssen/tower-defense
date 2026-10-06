/**
 * Isometric projection helpers (pure, no Phaser).
 *
 * Grid coordinates are continuous cell units (cell (i, j) center = (i + 0.5, j + 0.5)).
 * Screen coordinates are world pixels of the Phaser scene (before camera transform).
 */
import { TOWER_FOOTPRINT } from '@td/shared';
import type { GridPos, Vec2 } from '@td/shared';

export const TILE_W = 32;
export const TILE_H = 16;

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Projects continuous grid coordinates to screen (world) pixels. */
export function gridToScreen(
  x: number,
  y: number,
  out: ScreenPoint = { x: 0, y: 0 },
): ScreenPoint {
  out.x = (x - y) * HALF_W;
  out.y = (x + y) * HALF_H;
  return out;
}

/** Exact inverse of {@link gridToScreen}. */
export function screenToGrid(
  sx: number,
  sy: number,
  out: ScreenPoint = { x: 0, y: 0 },
): ScreenPoint {
  const a = sx / HALF_W; // x - y
  const b = sy / HALF_H; // x + y
  out.x = (a + b) / 2;
  out.y = (b - a) / 2;
  return out;
}

/** Render depth of an entity anchored at continuous grid coordinates: the screen y of the anchor. */
export function depthFor(x: number, y: number): number {
  return (x + y) * HALF_H;
}

/** Top-left cell of the tower footprint centered on the cursor (continuous grid coordinates). */
export function footprintTopLeftForCursor(gx: number, gy: number): GridPos {
  const half = TOWER_FOOTPRINT / 2;
  return { x: Math.round(gx) - half, y: Math.round(gy) - half };
}

/** Visual anchor of a tower (center of its footprint) in continuous grid coordinates. */
export function towerAnchor(pos: GridPos): Vec2 {
  const half = TOWER_FOOTPRINT / 2;
  return { x: pos.x + half, y: pos.y + half };
}

/** True when the integer cell (cx, cy) lies inside the footprint whose top-left cell is `pos`. */
export function footprintContains(
  pos: GridPos,
  cx: number,
  cy: number,
): boolean {
  return (
    cx >= pos.x &&
    cx < pos.x + TOWER_FOOTPRINT &&
    cy >= pos.y &&
    cy < pos.y + TOWER_FOOTPRINT
  );
}

/**
 * Corners (top, right, bottom, left in screen space) of the grid-aligned rectangle
 * [x, x + w] x [y, y + h], projected to screen pixels.
 */
export function rectDiamond(
  x: number,
  y: number,
  w: number,
  h: number,
): ScreenPoint[] {
  return [
    gridToScreen(x, y),
    gridToScreen(x + w, y),
    gridToScreen(x + w, y + h),
    gridToScreen(x, y + h),
  ];
}

/**
 * Horizontal radius in screen pixels of a grid-space circle of `radius` cells. The projected circle is
 * an ellipse whose vertical radius is half of this value (draw a circle and set scaleY = 0.5).
 */
export function isoRadiusPx(radius: number): number {
  return radius * HALF_W * Math.SQRT2;
}

/** Screen-space bounds of a lane of `width` x `height` cells. */
export function laneScreenBounds(
  width: number,
  height: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: -height * HALF_W,
    maxX: width * HALF_W,
    minY: 0,
    maxY: (width + height) * HALF_H,
  };
}

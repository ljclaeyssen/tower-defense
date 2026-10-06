import { TOWER_FOOTPRINT, type GridPos, type Vec2 } from '@td/shared';

export interface GridDims {
  readonly width: number;
  readonly height: number;
}

/** Row-major cell index. */
export const cellIndex = (lane: GridDims, x: number, y: number): number =>
  y * lane.width + x;

export const inBounds = (lane: GridDims, x: number, y: number): boolean =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < lane.width &&
  y < lane.height;

export const cellX = (lane: GridDims, index: number): number =>
  index % lane.width;
export const cellY = (lane: GridDims, index: number): number =>
  (index - (index % lane.width)) / lane.width;

/** Center of a cell in continuous cell units. */
export const cellCenterX = (lane: GridDims, index: number): number =>
  cellX(lane, index) + 0.5;
export const cellCenterY = (lane: GridDims, index: number): number =>
  cellY(lane, index) + 0.5;

/** The TOWER_FOOTPRINT x TOWER_FOOTPRINT cells covered by a tower whose top-left cell is `pos` (row-major). */
export function footprintCells(pos: GridPos): GridPos[] {
  const cells: GridPos[] = [];
  for (let dy = 0; dy < TOWER_FOOTPRINT; dy++) {
    for (let dx = 0; dx < TOWER_FOOTPRINT; dx++) {
      cells.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return cells;
}

/** Center of a tower footprint (the render anchor and the range origin). */
export function towerCenter(pos: GridPos): Vec2 {
  const half = TOWER_FOOTPRINT / 2;
  return { x: pos.x + half, y: pos.y + half };
}

export interface SolidSource extends GridDims {
  readonly blocked: readonly boolean[];
  readonly towers: readonly { readonly pos: GridPos }[];
}

/** Row-major solid mask: map-blocked cells plus every tower footprint. */
export function buildSolidMask(lane: SolidSource): boolean[] {
  const solid = lane.blocked.slice();
  for (const tower of lane.towers) {
    for (const c of footprintCells(tower.pos)) {
      if (inBounds(lane, c.x, c.y)) solid[cellIndex(lane, c.x, c.y)] = true;
    }
  }
  return solid;
}

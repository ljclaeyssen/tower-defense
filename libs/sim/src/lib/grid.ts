import {
  TOWER_FOOTPRINT,
  type CellKind,
  type GridPos,
  type MapDef,
  type Vec2,
} from '@td/shared';

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

/** Creeps walk on the road, and on ground too when the map allows it. Rocks are never walkable. */
export const isWalkableKind = (
  kind: CellKind | undefined,
  groundWalkable: boolean,
): boolean => kind === 'path' || (groundWalkable && kind === 'ground');

export interface WalkSource extends GridDims {
  readonly cells: readonly CellKind[];
  readonly groundWalkable: boolean;
  readonly towers: readonly { readonly pos: GridPos }[];
}

/** Row-major mask of the cells covered by tower footprints. */
export function buildTowerMask(
  lane: GridDims & { readonly towers: readonly { readonly pos: GridPos }[] },
): boolean[] {
  const mask = new Array<boolean>(lane.width * lane.height).fill(false);
  for (const tower of lane.towers) {
    for (const c of footprintCells(tower.pos)) {
      if (inBounds(lane, c.x, c.y)) mask[cellIndex(lane, c.x, c.y)] = true;
    }
  }
  return mask;
}

/** Row-major solid mask for creeps: every non-walkable cell plus every tower footprint. */
export function buildSolidMask(lane: WalkSource): boolean[] {
  const solid = buildTowerMask(lane);
  for (let i = 0; i < solid.length; i++) {
    if (!isWalkableKind(lane.cells[i], lane.groundWalkable)) solid[i] = true;
  }
  return solid;
}

/**
 * Expands the road waypoints into cells, in walking order (spawn first), without duplicates.
 * Each segment is widened by `pathWidth - 1` cells on its bottom side (horizontal segments) or its
 * right side (vertical segments). Throws on non-integer waypoints, diagonal segments or an invalid
 * width. Cells are not clipped to the grid (see `buildCells` for the bounds check).
 */
export function expandPath(map: Pick<MapDef, 'path' | 'pathWidth'>): GridPos[] {
  const width = map.pathWidth ?? 1;
  if (!Number.isInteger(width) || width < 1)
    throw new Error(`expandPath: invalid pathWidth ${width}`);
  const out: GridPos[] = [];
  const seen = new Set<string>();
  const push = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };
  const points = map.path;
  for (const p of points) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) {
      throw new Error(
        `expandPath: waypoint (${p.x}, ${p.y}) is not on the grid`,
      );
    }
  }
  if (points.length === 1 && points[0]) {
    for (let k = 0; k < width; k++) push(points[0].x, points[0].y + k);
  }
  for (let s = 1; s < points.length; s++) {
    const a = points[s - 1];
    const b = points[s];
    if (!a || !b) continue;
    if (a.x !== b.x && a.y !== b.y) {
      throw new Error(
        `expandPath: segment (${a.x}, ${a.y}) -> (${b.x}, ${b.y}) is not axis-aligned`,
      );
    }
    const horizontal = a.y === b.y;
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const steps = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    for (let i = 0; i <= steps; i++) {
      const x = a.x + dx * i;
      const y = a.y + dy * i;
      for (let k = 0; k < width; k++)
        push(horizontal ? x : x + k, horizontal ? y + k : y);
    }
  }
  return out;
}

/**
 * Row-major cell kinds of a map: ground everywhere, rocks, then the expanded road. Throws when the
 * road leaves the grid, crosses a rock, or does not start at `spawn` / end at `exit`.
 */
export function buildCells(map: MapDef): CellKind[] {
  const first = map.path[0];
  const last = map.path[map.path.length - 1];
  if (!first || first.x !== map.spawn.x || first.y !== map.spawn.y) {
    throw new Error(
      `map ${map.id}: the first path waypoint must equal the spawn`,
    );
  }
  if (!last || last.x !== map.exit.x || last.y !== map.exit.y) {
    throw new Error(
      `map ${map.id}: the last path waypoint must equal the exit`,
    );
  }
  const cells = new Array<CellKind>(map.width * map.height).fill('ground');
  for (const r of map.rocks ?? []) {
    if (!inBounds(map, r.x, r.y))
      throw new Error(
        `map ${map.id}: rock (${r.x}, ${r.y}) is outside the grid`,
      );
    cells[cellIndex(map, r.x, r.y)] = 'rock';
  }
  for (const c of expandPath(map)) {
    if (!inBounds(map, c.x, c.y))
      throw new Error(
        `map ${map.id}: road cell (${c.x}, ${c.y}) is outside the grid`,
      );
    const i = cellIndex(map, c.x, c.y);
    if (cells[i] === 'rock')
      throw new Error(`map ${map.id}: road cell (${c.x}, ${c.y}) is on a rock`);
    cells[i] = 'path';
  }
  return cells;
}

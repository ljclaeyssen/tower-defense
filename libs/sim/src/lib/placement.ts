import {
  getTowerDef,
  type CreepState,
  type GamePhase,
  type GameState,
  type GridPos,
  type LaneState,
  type PlayerId,
  type RejectReason,
  type TowerTypeId,
} from '@td/shared';
import {
  buildSolidMask,
  buildTowerMask,
  cellIndex,
  footprintCells,
  inBounds,
  type WalkSource,
} from './grid.js';
import { computeFlowField } from './flowfield.js';
import { isKnownTowerType } from './model.js';

export interface PlacementContext {
  readonly phase: GamePhase;
  readonly lane: WalkSource & {
    readonly spawn: GridPos;
    readonly exit: GridPos;
  };
  readonly gold: number;
  /** Faction of the building player: only its towers may be placed. */
  readonly faction: string;
  /** Lazily evaluated: every cell a living creep stands in or is heading to. */
  readonly creepCells: () => readonly number[];
}

/**
 * Shared placement rules, used both by `Game.apply` (internal model) and by the public
 * `validatePlacement` (snapshot). The first failing reason wins, in this order:
 * GameNotRunning, UnknownType, WrongFaction, OutOfBounds, CellBlocked, OverlapsTower, OverlapsCreep, BlocksPath,
 * NotEnoughGold. (UnknownPlayer is checked by the callers.)
 */
export function checkPlacement(
  ctx: PlacementContext,
  towerType: TowerTypeId,
  pos: GridPos,
  checkGold: boolean,
): RejectReason | null {
  const { lane } = ctx;
  if (ctx.phase !== 'running') return 'GameNotRunning';
  if (!isKnownTowerType(towerType)) return 'UnknownType';
  if (getTowerDef(towerType).faction !== ctx.faction) return 'WrongFaction';
  if (!pos || typeof pos !== 'object') return 'OutOfBounds';

  const cells = footprintCells(pos);
  for (const c of cells) {
    if (!inBounds(lane, c.x, c.y)) return 'OutOfBounds';
  }
  const indices = cells.map((c) => cellIndex(lane, c.x, c.y));
  const spawnIndex = cellIndex(lane, lane.spawn.x, lane.spawn.y);
  const exitIndex = cellIndex(lane, lane.exit.x, lane.exit.y);
  for (const i of indices) {
    // Only ground is buildable: the road (incl. spawn and exit) and rocks are not.
    if (lane.cells[i] !== 'ground' || i === spawnIndex || i === exitIndex)
      return 'CellBlocked';
  }

  const towerMask = buildTowerMask(lane);
  for (const i of indices) {
    if (towerMask[i] === true) return 'OverlapsTower';
  }

  const creepCells = ctx.creepCells();
  for (const i of indices) {
    if (creepCells.includes(i)) return 'OverlapsCreep';
  }

  // Creeps only stand on walkable cells, so OverlapsCreep and BlocksPath can only trigger on maps
  // with walkable ground. The road always links spawn and exit, so BlocksPath in practice means
  // a creep walking on ground would be trapped.
  const solid = buildSolidMask(lane);
  for (const i of indices) solid[i] = true;
  const field = computeFlowField(
    lane.width,
    lane.height,
    lane.exit,
    (x, y) => solid[y * lane.width + x] === true,
  );
  if ((field.dist[spawnIndex] ?? -1) < 0) return 'BlocksPath';
  for (const i of creepCells) {
    if ((field.dist[i] ?? -1) < 0) return 'BlocksPath';
  }

  if (checkGold) {
    const cost = getTowerDef(towerType).levels[0]?.cost ?? 0;
    if (ctx.gold < cost) return 'NotEnoughGold';
  }
  return null;
}

/**
 * Cells occupied by a creep as seen from a snapshot: the cell it stands in and the cell it walks
 * to. Creeps always walk between the centers of 4-adjacent cells, so both are recovered from the
 * position and the (axis-aligned) facing direction. The cell containing `pos` is always included.
 */
export function creepCellsFromSnapshot(
  lane: LaneState,
  creep: CreepState,
): number[] {
  const out: number[] = [];
  const push = (x: number, y: number): void => {
    if (!inBounds(lane, x, y)) return;
    const i = cellIndex(lane, x, y);
    if (!out.includes(i)) out.push(i);
  };
  const { x, y } = creep.pos;
  const { dir } = creep;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  push(fx, fy);
  const ax = Math.abs(dir.x);
  const ay = Math.abs(dir.y);
  if (ax === 0 && ay === 0) return out;
  if (ax >= ay) {
    const from = dir.x > 0 ? Math.floor(x - 0.5) : Math.ceil(x + 0.5) - 1;
    push(from, fy);
    push(dir.x > 0 ? from + 1 : from - 1, fy);
  } else {
    const from = dir.y > 0 ? Math.floor(y - 0.5) : Math.ceil(y + 0.5) - 1;
    push(fx, from);
    push(fx, dir.y > 0 ? from + 1 : from - 1);
  }
  return out;
}

/**
 * Pure placement check on a snapshot (renderer ghost preview). Returns the first failing reason or
 * null when `apply({ type: 'PlaceTower', ... })` would succeed. `checkGold` defaults to true.
 */
export function validatePlacement(
  state: GameState,
  playerId: PlayerId,
  towerType: TowerTypeId,
  pos: GridPos,
  options?: { checkGold?: boolean },
): RejectReason | null {
  const player = state.players[playerId];
  const lane = state.lanes[playerId];
  if (!Number.isInteger(playerId) || !player || !lane) return 'UnknownPlayer';
  return checkPlacement(
    {
      phase: state.phase,
      lane,
      gold: player.gold,
      faction: player.faction,
      creepCells: () =>
        lane.creeps.flatMap((c) => creepCellsFromSnapshot(lane, c)),
    },
    towerType,
    pos,
    options?.checkGold ?? true,
  );
}

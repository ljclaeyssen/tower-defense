import {
  DEFAULT_FACTION,
  TOWER_ROLES,
  getFactionTowers,
  getMaxLevel,
  type FactionId,
  type GameConfig,
  type GameEvent,
  type GridPos,
  type MapDef,
  type TowerRole,
  type TowerTypeId,
} from '@td/shared';
import type { Game } from './api.js';
import { createGame } from './game.js';

/*
 * Test fixtures shared by the spec files (pure data and helpers, no test framework imports).
 */

const row = (y: number, width: number): GridPos[] =>
  Array.from({ length: width }, (_, x) => ({ x, y }));

/**
 * 8x5 open field with walkable ground (mazing mode). The road runs around the bottom border:
 * (0,2) down to (0,4), along row 4, up to the exit (7,2). Creeps take the shorter straight line
 * over the ground on row 2. One rock at (5,0).
 *   y0  .....R..
 *   y1  ........
 *   y2  S......E
 *   y3  #......#     (# = road)
 *   y4  ########
 */
export const OPEN_MAP: MapDef = {
  id: 'open',
  width: 8,
  height: 5,
  spawn: { x: 0, y: 2 },
  exit: { x: 7, y: 2 },
  path: [
    { x: 0, y: 2 },
    { x: 0, y: 4 },
    { x: 7, y: 4 },
    { x: 7, y: 2 },
  ],
  rocks: [{ x: 5, y: 0 }],
  groundWalkable: true,
};

/**
 * 8x5 walkable-ground corridor: rocks on rows 0 and 4, road on row 3 (from (0,2) down, along
 * row 3, up to (7,2)), ground on rows 1-2. Creeps walk the ground on row 2.
 */
export const CORRIDOR3_MAP: MapDef = {
  id: 'corridor3',
  width: 8,
  height: 5,
  spawn: { x: 0, y: 2 },
  exit: { x: 7, y: 2 },
  path: [
    { x: 0, y: 2 },
    { x: 0, y: 3 },
    { x: 7, y: 3 },
    { x: 7, y: 2 },
  ],
  rocks: [...row(0, 8), ...row(4, 8)],
  groundWalkable: true,
};

/** 16x5, straight one-cell road on row 2 from spawn (0,2) to exit (15,2); ground is not walkable. */
export const LONG_MAP: MapDef = {
  id: 'long',
  width: 16,
  height: 5,
  spawn: { x: 0, y: 2 },
  exit: { x: 15, y: 2 },
  path: [
    { x: 0, y: 2 },
    { x: 15, y: 2 },
  ],
};

export const pveConfig = (
  map?: MapDef,
  faction: FactionId = DEFAULT_FACTION,
): GameConfig => ({
  mode: 'pve',
  players: [{ id: 0, team: 'blue', faction }],
  mapId: 'basic',
  ...(map ? { mapOverride: map } : {}),
});

export const pvpConfig = (
  map?: MapDef,
  factions: readonly [FactionId, FactionId] = [
    DEFAULT_FACTION,
    DEFAULT_FACTION,
  ],
): GameConfig => ({
  mode: 'pvp',
  players: [
    { id: 0, team: 'blue', faction: factions[0] },
    { id: 1, team: 'red', faction: factions[1] },
  ],
  mapId: 'basic',
  ...(map ? { mapOverride: map } : {}),
});

/** Steps `n` ticks and returns every event emitted meanwhile. */
export function stepN(game: Game, n: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    game.step();
    events.push(...game.drainEvents());
  }
  return events;
}

/** Places any tower type for `playerId`. */
export const placeTower = (
  game: Game,
  towerType: TowerTypeId,
  pos: GridPos,
  playerId = 0,
) => game.apply({ type: 'PlaceTower', towerType, pos }, playerId);

/** Shortcut: places the humans' single-target tower (`human-archer`) at (x, y). */
export const place = (game: Game, x: number, y: number, playerId = 0) =>
  placeTower(game, 'human-archer', { x, y }, playerId);

/** PvP helper: player 1 sends `count` beetles into lane 0 (spawning from the current tick on). */
export const sendToLane0 = (game: Game, count = 1) =>
  game.apply({ type: 'SendCreeps', creepType: 'beetle', count }, 1);

/** Tower type of `faction` for `role` (factions list one tower per role, in TOWER_ROLES order). */
export function towerOf(faction: FactionId, role: TowerRole): TowerTypeId {
  const type = getFactionTowers(faction)[TOWER_ROLES.indexOf(role)];
  if (!type) throw new Error(`faction ${faction} has no ${role} tower`);
  return type;
}

/**
 * Ground positions of the scripted build on the serpentine `basic` map, one per role. Corridors are
 * 4 cells wide, so a tower at x = 6 (corridor 1, x5..8) or x = 11 (corridor 2, x10..13) is centered:
 * 2.5 cells from both vertical runs. Single and slow sit in corridor 1 near its bottom U-turn
 * (row 13, 1.5 cells below the single tower), pierce and burst in corridor 2 under its top U-turn
 * (row 2, 1.5 cells above the pierce tower).
 */
export const BALANCE_POSITIONS: Readonly<Record<TowerRole, GridPos>> = {
  single: { x: 6, y: 11 },
  slow: { x: 6, y: 8 },
  pierce: { x: 11, y: 3 },
  burst: { x: 11, y: 6 },
};

/** Build order: single + slow fit the 150 starting gold, pierce and burst follow as gold allows. */
export const BALANCE_ORDER: readonly TowerRole[] = [
  'single',
  'slow',
  'pierce',
  'burst',
];

export interface BuildStep {
  readonly type: TowerTypeId;
  readonly pos: GridPos;
}

/** The faction's 4 towers (one per role) in build order, on BALANCE_POSITIONS (overridable). */
export function scriptedBuild(
  faction: FactionId,
  positions: Partial<Record<TowerRole, GridPos>> = {},
): BuildStep[] {
  return BALANCE_ORDER.map((role) => ({
    type: towerOf(faction, role),
    pos: positions[role] ?? BALANCE_POSITIONS[role],
  }));
}

/**
 * Scripted PvE game on the real `basic` map for `faction` (null = no towers at all).
 * At tick 0 and then every 100 ticks: place the pending towers of `scriptedBuild` in order while
 * affordable (stopping at the first unaffordable one); once all are placed, upgrade the
 * lowest-level tower (tie: lowest id) while gold allows. Runs until the game ends (or `maxTicks`).
 */
export function runScriptedPve(
  faction: FactionId | null,
  seed = 1,
  options: {
    positions?: Partial<Record<TowerRole, GridPos>>;
    maxTicks?: number;
  } = {},
): { game: Game; events: GameEvent[] } {
  const game = createGame(
    pveConfig(undefined, faction ?? DEFAULT_FACTION),
    seed,
  );
  const pending = faction ? scriptedBuild(faction, options.positions) : [];
  const maxTicks = options.maxTicks ?? 20000;
  const events: GameEvent[] = [];
  const act = (): void => {
    while (pending.length > 0) {
      const next = pending[0];
      if (!next || !placeTower(game, next.type, next.pos).ok) return;
      pending.shift();
    }
    for (;;) {
      const towers = game.getState().lanes[0]?.towers ?? [];
      const candidate = [...towers]
        .filter((t) => t.level < getMaxLevel(t.type))
        .sort((a, b) => a.level - b.level || a.id - b.id)[0];
      if (
        !candidate ||
        !game.apply({ type: 'UpgradeTower', towerId: candidate.id }, 0).ok
      )
        return;
    }
  };
  while (
    game.getState().phase === 'running' &&
    game.getState().tick < maxTicks
  ) {
    if (faction && game.getState().tick % 100 === 0) act();
    game.step();
    events.push(...game.drainEvents());
  }
  return { game, events };
}

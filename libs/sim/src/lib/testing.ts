import type { GameConfig, GameEvent, GridPos, MapDef } from '@td/shared';
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

export const pveConfig = (map?: MapDef): GameConfig => ({
  mode: 'pve',
  players: [{ id: 0, team: 'blue' }],
  mapId: 'basic',
  ...(map ? { mapOverride: map } : {}),
});

export const pvpConfig = (map?: MapDef): GameConfig => ({
  mode: 'pvp',
  players: [
    { id: 0, team: 'blue' },
    { id: 1, team: 'red' },
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

export const place = (game: Game, x: number, y: number, playerId = 0) =>
  game.apply(
    { type: 'PlaceTower', towerType: 'archer', pos: { x, y } },
    playerId,
  );

/** PvP helper: player 1 sends `count` beetles into lane 0 (spawning from the current tick on). */
export const sendToLane0 = (game: Game, count = 1) =>
  game.apply({ type: 'SendCreeps', creepType: 'beetle', count }, 1);

/**
 * One archer on the ground of each corridor between vertical road segments. Each tower center is
 * 2.5 and 3.5 cells from the two roads bounding its corridor, so it covers both.
 */
export const BALANCE_BUILD: readonly GridPos[] = [
  { x: 6, y: 4 },
  { x: 12, y: 9 },
  { x: 18, y: 4 },
];

/**
 * Scripted PvE game on the real `basic` map. With `build`, three archers are placed along the
 * road (see BALANCE_BUILD) at tick 0, then every 100 ticks the lowest-level tower (tie: lowest id) is
 * upgraded as long as gold allows. Runs until the game ends (or `maxTicks`).
 */
export function runScriptedPve(
  build: boolean,
  seed = 1,
  maxTicks = 20000,
): { game: Game; events: GameEvent[] } {
  const game = createGame(pveConfig(), seed);
  const events: GameEvent[] = [];
  if (build) {
    for (const p of BALANCE_BUILD) place(game, p.x, p.y);
  }
  events.push(...game.drainEvents());
  while (
    game.getState().phase === 'running' &&
    game.getState().tick < maxTicks
  ) {
    const tick = game.getState().tick;
    if (build && tick > 0 && tick % 100 === 0) {
      for (;;) {
        const towers = game.getState().lanes[0]?.towers ?? [];
        const candidate = [...towers]
          .filter((t) => t.level < 3)
          .sort((a, b) => a.level - b.level || a.id - b.id)[0];
        if (
          !candidate ||
          !game.apply({ type: 'UpgradeTower', towerId: candidate.id }, 0).ok
        )
          break;
      }
    }
    game.step();
    events.push(...game.drainEvents());
  }
  return { game, events };
}

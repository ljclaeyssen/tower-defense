import { CREEPS, ECONOMY } from '@td/shared';
import { createGame } from './game.js';
import {
  LONG_MAP,
  OPEN_MAP,
  place,
  pveConfig,
  pvpConfig,
  sendToLane0,
  stepN,
} from './testing.js';

describe('creeps', () => {
  it('move speed cells per tick toward the exit, with dir and distanceToExit', () => {
    const game = createGame(pvpConfig(OPEN_MAP), 1);
    sendToLane0(game, 1);
    stepN(game, 1);
    const creep = game.getState().lanes[0]?.creeps[0];
    expect(creep).toMatchObject({
      playerId: 0,
      type: 'beetle',
      speed: CREEPS.beetle.speed,
      dir: { x: 1, y: 0 },
      waveIndex: 0,
    });
    expect(creep?.pos.x).toBeCloseTo(0.5 + CREEPS.beetle.speed, 9);
    expect(creep?.pos.y).toBe(2.5);
    // Target cell (1,2) is 6 steps from the exit, plus 0.9 to its center.
    expect(creep?.distanceToExit).toBeCloseTo(6.9, 9);
    stepN(game, 24);
    const later = game.getState().lanes[0]?.creeps[0];
    expect(later?.pos.x).toBeCloseTo(0.5 + 25 * CREEPS.beetle.speed, 9);
    expect(later?.distanceToExit).toBeCloseTo(7 - 2.5, 9);
  });

  it('follow a recomputed flow field from the next cell center on', () => {
    const game = createGame(pvpConfig(OPEN_MAP), 1);
    sendToLane0(game, 1);
    stepN(game, 8); // x = 1.3: cell (1,2) heading to (2,2)
    expect(place(game, 3, 1).ok).toBe(true); // cuts row 2 at x = 3..4
    stepN(game, 11); // x = 2.4: still heading straight to the center of (2,2)
    expect(game.getState().lanes[0]?.creeps[0]?.dir).toEqual({ x: 1, y: 0 });
    stepN(game, 2); // reached (2,2) and turned
    const creep = game.getState().lanes[0]?.creeps[0];
    expect(creep?.pos.x).toBe(2.5);
    expect(creep?.dir.x).toBe(0);
    expect(Math.abs(creep?.dir.y ?? 0)).toBe(1);
  });

  it('leaking costs a life and emits LifeLost', () => {
    const game = createGame(pvpConfig(OPEN_MAP), 1);
    sendToLane0(game, 1);
    const creepId = 1;
    expect(stepN(game, 69).some((e) => e.type === 'LifeLost')).toBe(false);
    const events = stepN(game, 1); // 7 cells at 0.1 cell/tick
    expect(events.filter((e) => e.type === 'LifeLost')).toEqual([
      {
        type: 'LifeLost',
        playerId: 0,
        creepId,
        livesAfter: ECONOMY.startingLives - 1,
      },
    ]);
    expect(game.getState().lanes[0]?.creeps).toHaveLength(0);
    expect(game.getState().players[0]?.lives).toBe(ECONOMY.startingLives - 1);
  });

  it('PvE defeat at 0 lives ends the game; afterwards step is a no-op and commands are rejected', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    const events = [];
    for (let t = 0; t < 5000 && game.getState().phase === 'running'; t++) {
      game.apply({ type: 'StartWave' }, 0);
      events.push(...stepN(game, 1));
    }
    const state = game.getState();
    expect(state).toMatchObject({
      phase: 'ended',
      result: 'defeat',
      winnerId: null,
    });
    expect(state.players[0]).toMatchObject({ lives: 0, alive: false });
    const lifeLost = events.filter((e) => e.type === 'LifeLost');
    expect(lifeLost).toHaveLength(ECONOMY.startingLives);
    expect(lifeLost.at(-1)).toMatchObject({ livesAfter: 0 });
    expect(events.at(-1)).toEqual({
      type: 'GameOver',
      result: 'defeat',
      winnerId: null,
    });

    const hash = game.hash();
    game.step();
    expect(game.getState()).toBe(state);
    expect(game.hash()).toBe(hash);
    expect(game.drainEvents()).toEqual([]);
    expect(place(game, 2, 0)).toEqual({ ok: false, reason: 'GameNotRunning' });
    expect(game.apply({ type: 'StartWave' }, 0)).toEqual({
      ok: false,
      reason: 'GameNotRunning',
    });
    expect(game.apply({ type: 'UpgradeTower', towerId: 1 }, 0)).toEqual({
      ok: false,
      reason: 'GameNotRunning',
    });
  });

  it('PvP: the last player alive wins; simultaneous deaths are a draw', () => {
    const run = (defend: boolean) => {
      const game = createGame(pvpConfig(LONG_MAP), 1);
      if (defend) {
        place(game, 2, 0);
        place(game, 6, 3);
        place(game, 10, 0);
      }
      for (let t = 0; t < 20000 && game.getState().phase === 'running'; t++)
        game.step();
      return game.getState();
    };
    expect(run(true)).toMatchObject({
      phase: 'ended',
      result: 'victory',
      winnerId: 0,
    });
    expect(run(false)).toMatchObject({
      phase: 'ended',
      result: 'draw',
      winnerId: null,
    });
  });
});

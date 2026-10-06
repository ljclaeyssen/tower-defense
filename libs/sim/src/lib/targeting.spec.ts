import {
  DEFAULT_TARGETING,
  TARGET_ORDERS,
  getTowerLevel,
  type GameEvent,
  type GameState,
  type TargetOrder,
} from '@td/shared';
import { createGame } from './game.js';
import type { SimCreep } from './model.js';
import { LONG_MAP, placeTower, pvpConfig, sendToLane0 } from './testing.js';
import { selectTarget } from './towers.js';

/** Crafted creep: only the fields used by targeting matter. */
function creep(
  id: number,
  f: { d: number; hp: number; x: number; y: number; slow?: number },
): SimCreep {
  return {
    id,
    playerId: 0,
    type: 'beetle',
    x: f.x,
    y: f.y,
    hp: f.hp,
    maxHp: 100,
    speed: 0.1,
    slowFactor: f.slow ?? 1,
    slowTicks: f.slow !== undefined && f.slow !== 1 ? 10 : 0,
    dirX: 1,
    dirY: 0,
    cell: 0,
    target: -1,
    distanceToExit: f.d,
    waveIndex: 0,
    bounty: 1,
  };
}

// Tower at (0,0): center (1,1). Each creep is the extreme of exactly one metric.
const A = creep(1, { d: 2, hp: 50, x: 4, y: 1 }); // first (closest to the exit); 3 from the tower
const B = creep(2, { d: 9, hp: 40, x: 3, y: 1 }); // last
const C = creep(3, { d: 5, hp: 90, x: 1, y: 6 }); // strongest; farthest (5)
const D = creep(4, { d: 6, hp: 10, x: 2, y: 1 }); // weakest; nearest (1)
const ALL = [A, B, C, D];
const tower = (targetId: number | null = null) => ({
  pos: { x: 0, y: 0 },
  targetId,
});

describe('selectTarget: orders', () => {
  const expected: Record<TargetOrder, SimCreep> = {
    first: A,
    last: B,
    strongest: C,
    weakest: D,
    nearest: D,
    farthest: C,
  };

  it.each(TARGET_ORDERS)('%s picks the expected creep', (order) => {
    expect(selectTarget(tower(), ALL, { order })).toBe(expected[order]);
    // Candidate order does not matter.
    expect(selectTarget(tower(), [...ALL].reverse(), { order })).toBe(
      expected[order],
    );
  });

  it('breaks ties on the lowest id', () => {
    const p = creep(7, { d: 3, hp: 20, x: 5, y: 5 });
    const q = creep(5, { d: 3, hp: 20, x: 5, y: 5 });
    for (const order of TARGET_ORDERS) {
      expect(selectTarget(tower(), [p, q], { order })?.id).toBe(5);
    }
  });

  it('returns null without candidates', () => {
    expect(selectTarget(tower(), [], DEFAULT_TARGETING)).toBeNull();
  });
});

describe('selectTarget: filters and stickiness', () => {
  const slowedA = { ...A, slowFactor: 0.5, slowTicks: 10 };
  const unslowed = { order: 'first', filters: ['unslowed'] } as const;

  it('unslowed filter skips slowed creeps', () => {
    expect(selectTarget(tower(), [slowedA, B, C, D], unslowed)).toBe(C);
  });

  it('falls back to all candidates (frontmost) when everything is slowed', () => {
    const all = [slowedA, { ...C, slowFactor: 0.6 }];
    expect(selectTarget(tower(), all, unslowed)).toBe(slowedA);
  });

  it('sticky (default) keeps the current target while it stays a candidate', () => {
    expect(selectTarget(tower(B.id), ALL, DEFAULT_TARGETING)).toBe(B);
    expect(
      selectTarget(tower(B.id), ALL, { order: 'first', sticky: true }),
    ).toBe(B);
    // Gone (dead or out of range) -> re-evaluate.
    expect(selectTarget(tower(B.id), [A, C], DEFAULT_TARGETING)).toBe(A);
  });

  it('sticky: false re-evaluates every time', () => {
    expect(
      selectTarget(tower(B.id), ALL, { order: 'first', sticky: false }),
    ).toBe(A);
  });

  it('with a filter, the current target is dropped once it no longer passes', () => {
    const slowedC = { ...C, slowFactor: 0.5 };
    expect(selectTarget(tower(C.id), [A, slowedC], unslowed)).toBe(A);
    // ...but kept in the fallback case (no creep passes the filter).
    expect(selectTarget(tower(C.id), [slowedA, slowedC], unslowed)).toBe(
      slowedC,
    );
  });

  it('first towers are unchanged: frontmost, sticky even when the target is slowed', () => {
    expect(selectTarget(tower(), [slowedA, B, C, D], DEFAULT_TARGETING)).toBe(
      slowedA,
    );
    expect(selectTarget(tower(D.id), [slowedA, B, C, D], undefined)).toBe(D);
  });
});

describe('slow towers in a game', () => {
  it('hit the front creep, switch to the next while it is slowed, come back when the slow expires', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    expect(placeTower(game, 'human-frostmage', { x: 6, y: 3 }).ok).toBe(true);
    expect(getTowerLevel('human-frostmage', 1).targeting?.filters).toEqual([
      'unslowed',
    ]);
    sendToLane0(game, 2); // two beetles, 1 cell apart on the row-2 road
    const shots: {
      target: number;
      slowedAtFire: boolean;
      anyUnslowed: boolean;
    }[] = [];
    let before: GameState = game.getState();
    for (let t = 0; t < 200 && shots.length < 4; t++) {
      game.step();
      const events: GameEvent[] = game.drainEvents();
      for (const e of events) {
        if (e.type !== 'ProjectileFired') continue;
        const creeps = before.lanes[0]?.creeps ?? [];
        const target = creeps.find((c) => c.id === e.projectile.targetId);
        shots.push({
          target: e.projectile.targetId,
          slowedAtFire: (target?.slowFactor ?? 1) !== 1,
          anyUnslowed: creeps.some((c) => c.slowFactor === 1),
        });
      }
      before = game.getState();
    }
    const ids = [...new Set(shots.map((s) => s.target))];
    expect(ids).toHaveLength(2);
    const [first, next] = ids as [number, number];
    expect(first).toBeLessThan(next); // the front creep spawned first
    // 1) front creep, 2) the second one while the front is slowed, 3) both slowed: keep shooting,
    // 4) back to the front creep once its slow expired.
    expect(shots.map((s) => s.target)).toEqual([first, next, next, first]);
    expect(shots[1]?.slowedAtFire).toBe(false);
    expect(shots[2]?.anyUnslowed).toBe(false);
    expect(shots[3]?.slowedAtFire).toBe(false);
  });
});

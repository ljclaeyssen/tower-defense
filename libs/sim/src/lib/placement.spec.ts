import type { GameEvent, MapDef, TowerTypeId } from '@td/shared';
import { createGame } from './game.js';
import { cellIndex } from './grid.js';
import { validatePlacement } from './placement.js';
import {
  CORRIDOR3_MAP,
  OPEN_MAP,
  place,
  pveConfig,
  pvpConfig,
  sendToLane0,
  stepN,
} from './testing.js';

describe('placement validation', () => {
  it('rejects footprints leaving the grid with OutOfBounds', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    expect(place(game, 7, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(place(game, -1, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(place(game, 0, 4)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(place(game, 1.5, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
  });

  it('rejects footprints touching the spawn, the exit, the road or a rock with CellBlocked', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    expect(place(game, 0, 1)).toEqual({ ok: false, reason: 'CellBlocked' }); // spawn (0,2)
    expect(place(game, 6, 2)).toEqual({ ok: false, reason: 'CellBlocked' }); // exit (7,2)
    expect(place(game, 2, 3)).toEqual({ ok: false, reason: 'CellBlocked' }); // road on row 4
    expect(place(game, 4, 0)).toEqual({ ok: false, reason: 'CellBlocked' }); // rock (5,0)
    // Ground right next to the road is buildable.
    expect(place(game, 2, 2)).toEqual({ ok: true });
  });

  it('rejects overlapping towers with OverlapsTower', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    expect(place(game, 2, 0).ok).toBe(true);
    expect(place(game, 3, 0)).toEqual({ ok: false, reason: 'OverlapsTower' });
    expect(place(game, 2, 0)).toEqual({ ok: false, reason: 'OverlapsTower' });
  });

  it('rejects with NotEnoughGold once the gold is spent', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    expect(place(game, 1, 0).ok).toBe(true);
    expect(place(game, 3, 0).ok).toBe(true);
    expect(place(game, 5, 2).ok).toBe(true);
    expect(game.getState().players[0]?.gold).toBe(0);
    expect(place(game, 3, 2)).toEqual({ ok: false, reason: 'NotEnoughGold' });
    expect(
      validatePlacement(
        game.getState(),
        0,
        'human-archer',
        { x: 3, y: 2 },
        { checkGold: false },
      ),
    ).toBeNull();
  });

  it('respects the reason order (first failing reason wins)', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    const s = () => game.getState();
    expect(validatePlacement(s(), 3, 'human-archer', { x: 7, y: 0 })).toBe(
      'UnknownPlayer',
    );
    expect(
      validatePlacement(s(), 0, 'catapult' as TowerTypeId, { x: 7, y: 0 }),
    ).toBe('UnknownType');
    expect(
      validatePlacement(s(), 0, 'toString' as TowerTypeId, { x: 2, y: 0 }),
    ).toBe('UnknownType');
    // Out of bounds AND covering the spawn -> OutOfBounds.
    expect(validatePlacement(s(), 0, 'human-archer', { x: -1, y: 1 })).toBe(
      'OutOfBounds',
    );
    expect(place(game, 1, 0).ok).toBe(true);
    expect(place(game, 3, 0).ok).toBe(true);
    expect(place(game, 5, 2).ok).toBe(true);
    // Road cell AND overlapping a tower AND no gold -> CellBlocked.
    expect(validatePlacement(s(), 0, 'human-archer', { x: 5, y: 3 })).toBe(
      'CellBlocked',
    );
    // Overlapping a tower AND no gold -> OverlapsTower.
    expect(validatePlacement(s(), 0, 'human-archer', { x: 2, y: 0 })).toBe(
      'OverlapsTower',
    );
  });

  it('places a tower: deducts gold, emits GoldChanged then TowerPlaced', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    expect(place(game, 2, 0)).toEqual({ ok: true });
    const events = game.drainEvents();
    expect(events.map((e) => e.type)).toEqual(['GoldChanged', 'TowerPlaced']);
    expect(events[0]).toEqual({
      type: 'GoldChanged',
      playerId: 0,
      gold: 100,
      delta: -50,
      reason: 'build',
    });
    const tower = {
      id: 1,
      playerId: 0,
      type: 'human-archer',
      level: 1,
      pos: { x: 2, y: 0 },
      cooldown: 0,
      invested: 50,
      targetId: null,
    };
    expect(events[1]).toEqual({ type: 'TowerPlaced', tower });
    expect(game.getState().players[0]?.gold).toBe(100);
    expect(game.getState().lanes[0]?.towers).toEqual([tower]);
  });

  it('a rejected command emits CommandRejected and changes nothing', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    const before = game.getState();
    const hash = game.hash();
    const command = {
      type: 'PlaceTower',
      towerType: 'human-archer',
      pos: { x: 7, y: 0 },
    } as const;
    expect(game.apply(command, 0)).toEqual({
      ok: false,
      reason: 'OutOfBounds',
    });
    expect(game.drainEvents()).toEqual<GameEvent[]>([
      { type: 'CommandRejected', playerId: 0, command, reason: 'OutOfBounds' },
    ]);
    expect(game.getState()).toBe(before);
    expect(game.hash()).toBe(hash);
  });
});

describe('anti-blocking (walkable-ground maps)', () => {
  it('accepts a tower that leaves a detour and updates the flow field', () => {
    const game = createGame(pveConfig(CORRIDOR3_MAP), 1);
    const spawn = cellIndex(CORRIDOR3_MAP, 0, 2);
    expect(game.getState().lanes[0]?.flowField.dist[spawn]).toBe(7);
    expect(place(game, 3, 1).ok).toBe(true);
    // Creeps now detour over the road on row 3.
    expect(game.getState().lanes[0]?.flowField.dist[spawn]).toBe(9);
    // The road itself can never be built on, so the spawn can never be cut off.
    expect(place(game, 5, 2)).toEqual({ ok: false, reason: 'CellBlocked' });
  });
});

describe('overlapping creeps', () => {
  /** PvP lane 0 of a 3-row corridor with a single creep walking along row 2. */
  function singleCreep(steps: number) {
    const game = createGame(pvpConfig(CORRIDOR3_MAP), 1);
    expect(sendToLane0(game).ok).toBe(true);
    stepN(game, steps);
    return game;
  }

  it('rejects a footprint containing the cell a creep is in or heading to', () => {
    // After 23 ticks the creep is at x ~ 2.8: in cell (2,2), heading to (3,2).
    const game = singleCreep(23);
    const creep = game.getState().lanes[0]?.creeps[0];
    expect(creep?.pos.x).toBeCloseTo(2.8, 6);
    expect(creep?.dir).toEqual({ x: 1, y: 0 });
    // Current cell (2,2) only.
    expect(
      validatePlacement(game.getState(), 0, 'human-archer', { x: 1, y: 1 }),
    ).toBe('OverlapsCreep');
    expect(place(game, 1, 1)).toEqual({ ok: false, reason: 'OverlapsCreep' });
    // Target cell (3,2) only.
    expect(
      validatePlacement(game.getState(), 0, 'human-archer', { x: 3, y: 1 }),
    ).toBe('OverlapsCreep');
    expect(place(game, 3, 1)).toEqual({ ok: false, reason: 'OverlapsCreep' });
    // One cell further is fine.
    expect(
      validatePlacement(game.getState(), 0, 'human-archer', { x: 4, y: 1 }),
    ).toBeNull();
    expect(place(game, 4, 1).ok).toBe(true);
  });

  it('validatePlacement on a snapshot agrees with apply for every cell while creeps walk', () => {
    // Walkable-ground map: creeps cross the ground, so OverlapsCreep / BlocksPath are exercised.
    const game = createGame(pveConfig(OPEN_MAP), 3);
    game.apply({ type: 'StartWave' }, 0);
    let overlaps = 0;
    for (let round = 0; round < 12; round++) {
      stepN(game, 7);
      const { width, height } = game.getState().lanes[0] ?? {
        width: 0,
        height: 0,
      };
      for (let y = -1; y < height; y++) {
        for (let x = -1; x < width; x++) {
          const expected = validatePlacement(
            game.getState(),
            0,
            'human-archer',
            {
              x,
              y,
            },
          );
          const result = place(game, x, y);
          expect(result).toEqual(
            expected === null ? { ok: true } : { ok: false, reason: expected },
          );
          if (expected === 'OverlapsCreep') overlaps++;
        }
      }
    }
    expect(overlaps).toBeGreaterThan(20);
  });

  it('only considers creeps of the lane the tower is built in', () => {
    const game = singleCreep(23);
    expect(place(game, 1, 1, 1).ok).toBe(true);
  });

  it('rejects with BlocksPath when a living creep could not reach the exit anymore', () => {
    // Walkable ground: two 2-cell-high routes (rows 1-2 ground, rows 4-5 ground + road on row 5)
    // separated by a rock wall on row 3. Spawn (0,3), exit (9,3); the creep takes the upper route.
    const map: MapDef = {
      id: 'two-routes',
      width: 10,
      height: 7,
      spawn: { x: 0, y: 3 },
      exit: { x: 9, y: 3 },
      path: [
        { x: 0, y: 3 },
        { x: 0, y: 5 },
        { x: 9, y: 5 },
        { x: 9, y: 3 },
      ],
      rocks: [
        ...Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })),
        ...Array.from({ length: 10 }, (_, x) => ({ x, y: 6 })),
        ...Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: 3 })),
      ],
      groundWalkable: true,
    };
    const setup = () => {
      const game = createGame(pvpConfig(map), 1);
      expect(sendToLane0(game).ok).toBe(true);
      stepN(game, 44); // creep walks up to row 2 then right: cell (3,2) heading to (4,2)
      return game;
    };
    const game = setup();
    expect(game.getState().lanes[0]?.creeps[0]?.pos.x).toBeCloseTo(3.9, 6);
    // Cutting the upper route behind the creep is fine: the spawn still has the lower route.
    expect(place(game, 1, 1).ok).toBe(true);
    // Cutting it ahead as well would trap the creep in a pocket.
    expect(
      validatePlacement(game.getState(), 0, 'human-archer', { x: 6, y: 1 }),
    ).toBe('BlocksPath');
    expect(place(game, 6, 1)).toEqual({ ok: false, reason: 'BlocksPath' });
    // Without the tower behind it, the creep can still walk back: accepted.
    const other = setup();
    expect(place(other, 6, 1).ok).toBe(true);
  });
});

import { getMapDef, getTowerLevel } from '@td/shared';
import { computeFlowField } from './flowfield.js';
import { createGame } from './game.js';
import { cellIndex, expandPath, footprintCells, towerCenter } from './grid.js';
import { validatePlacement } from './placement.js';
import { OPEN_MAP, place, pveConfig } from './testing.js';

const W = 5;
const H = 4;
const idx = (x: number, y: number) => y * W + x;

describe('computeFlowField', () => {
  it('gives Manhattan distances to the exit on an open grid', () => {
    const field = computeFlowField(W, H, { x: 4, y: 3 }, () => false);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        expect(field.dist[idx(x, y)]).toBe(4 - x + (3 - y));
      }
    }
  });

  it('makes next point to a 4-adjacent neighbour one step closer, -1 at the exit', () => {
    const field = computeFlowField(W, H, { x: 4, y: 3 }, () => false);
    expect(field.next[idx(4, 3)]).toBe(-1);
    for (let i = 0; i < W * H; i++) {
      if (i === idx(4, 3)) continue;
      const n = field.next[i] ?? -1;
      expect(n).toBeGreaterThanOrEqual(0);
      expect(field.dist[n]).toBe((field.dist[i] ?? 0) - 1);
      const dx = Math.abs((n % W) - (i % W));
      const dy = Math.abs(Math.floor(n / W) - Math.floor(i / W));
      expect(dx + dy).toBe(1);
    }
    // Neighbour order is up, right, down, left: from (0,0) both right and down are closer -> right.
    expect(field.next[idx(0, 0)]).toBe(idx(1, 0));
  });

  it('marks solids and unreachable cells with -1', () => {
    const wallX = 2;
    const field = computeFlowField(W, H, { x: 4, y: 3 }, (x) => x === wallX);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x <= wallX; x++) {
        expect(field.dist[idx(x, y)]).toBe(-1);
        expect(field.next[idx(x, y)]).toBe(-1);
      }
      expect(field.dist[idx(3, y)]).toBe(1 + (3 - y));
    }
  });

  it('returns an all -1 field when the exit itself is solid', () => {
    const field = computeFlowField(
      W,
      H,
      { x: 4, y: 3 },
      (x, y) => x === 4 && y === 3,
    );
    expect(field.dist.every((d) => d === -1)).toBe(true);
  });

  it('treats tower footprints as solids in the lane flow field', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    const lane0 = game.getState().lanes[0];
    expect(lane0?.flowField.dist[cellIndex(OPEN_MAP, 0, 2)]).toBe(7);
    expect(place(game, 3, 1).ok).toBe(true);
    const lane = game.getState().lanes[0];
    for (const c of footprintCells({ x: 3, y: 1 })) {
      expect(lane?.flowField.dist[cellIndex(OPEN_MAP, c.x, c.y)]).toBe(-1);
      expect(lane?.flowField.next[cellIndex(OPEN_MAP, c.x, c.y)]).toBe(-1);
    }
    // The straight row-2 path is cut at x = 3..4: the detour costs two extra steps.
    expect(lane?.flowField.dist[cellIndex(OPEN_MAP, 0, 2)]).toBe(9);
    // Rocks are solid too.
    expect(lane?.flowField.dist[cellIndex(OPEN_MAP, 5, 0)]).toBe(-1);
  });
});

describe('expandPath / buildCells', () => {
  it('expands axis-aligned waypoints into cells in walking order, corners once', () => {
    expect(
      expandPath({
        path: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
        ],
      }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('widens segments on the bottom (horizontal) / right (vertical) side', () => {
    const cells = expandPath({
      path: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
      pathWidth: 2,
    });
    const keys = cells.map((c) => `${c.x},${c.y}`).sort();
    expect(keys).toEqual(
      [
        '0,0',
        '0,1',
        '1,0',
        '1,1',
        '2,0',
        '2,1',
        '2,2',
        '3,0',
        '3,1',
        '3,2',
      ].sort(),
    );
  });

  it('rejects diagonal segments', () => {
    expect(() =>
      expandPath({
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
    ).toThrow();
  });

  it('createGame validates the road against spawn, exit, bounds and rocks', () => {
    const base = { ...OPEN_MAP };
    expect(() =>
      createGame(pveConfig({ ...base, spawn: { x: 1, y: 2 } }), 1),
    ).toThrow();
    expect(() =>
      createGame(pveConfig({ ...base, exit: { x: 7, y: 3 } }), 1),
    ).toThrow();
    expect(() =>
      createGame(pveConfig({ ...base, rocks: [{ x: 3, y: 4 }] }), 1),
    ).toThrow();
    expect(() =>
      createGame(
        pveConfig({
          ...base,
          path: [
            { x: 0, y: 2 },
            { x: 9, y: 2 },
            { x: 7, y: 2 },
          ],
        }),
        1,
      ),
    ).toThrow();
  });

  it('exposes the cell kinds in the lane snapshot', () => {
    const lane = createGame(pveConfig(OPEN_MAP), 1).getState().lanes[0];
    expect(lane?.groundWalkable).toBe(true);
    expect(lane?.cells[cellIndex(OPEN_MAP, 0, 2)]).toBe('path');
    expect(lane?.cells[cellIndex(OPEN_MAP, 3, 4)]).toBe('path');
    expect(lane?.cells[cellIndex(OPEN_MAP, 5, 0)]).toBe('rock');
    expect(lane?.cells[cellIndex(OPEN_MAP, 3, 2)]).toBe('ground');
    expect(lane?.cells.filter((k) => k === 'path')).toHaveLength(12);
  });
});

describe('basic map (serpentine road)', () => {
  const map = getMapDef('basic');
  const game = createGame(pveConfig(), 1);
  const lane = game.getState().lanes[0];
  const road = expandPath(map);
  const at = (c: { x: number; y: number }) => cellIndex(map, c.x, c.y);

  it('is a one-cell road of about 70 cells from the spawn to the exit, ground not walkable', () => {
    expect(lane?.groundWalkable).toBe(false);
    expect(road[0]).toEqual(map.spawn);
    expect(road.at(-1)).toEqual(map.exit);
    expect(road.length).toBeGreaterThanOrEqual(65);
    expect(road.length).toBeLessThanOrEqual(90);
    // Distances decrease by one along the road, down to 0 at the exit.
    road.forEach((c, k) =>
      expect(lane?.flowField.dist[at(c)]).toBe(road.length - 1 - k),
    );
    // `next` follows the road exactly.
    road.forEach((c, k) => {
      const nxt = road[k + 1];
      expect(lane?.flowField.next[at(c)]).toBe(nxt ? at(nxt) : -1);
    });
    // Every other cell (ground, rocks) is unreachable.
    const roadSet = new Set(road.map(at));
    lane?.flowField.dist.forEach((d, i) => {
      if (!roadSet.has(i)) expect(d).toBe(-1);
    });
  });

  it('zig-zags through four vertical runs with 4-cell-wide (even) ground corridors in between', () => {
    const verticalXs = [
      ...new Set(road.filter((c, k) => road[k + 1]?.x === c.x).map((c) => c.x)),
    ];
    expect(verticalXs).toEqual([4, 9, 14, 19]);
    for (let i = 1; i < verticalXs.length; i++) {
      expect((verticalXs[i] ?? 0) - (verticalXs[i - 1] ?? 0) - 1).toBe(4);
    }
    // Tail corridor after the last run (x20..23) is 4 wide too.
    expect(map.width - 1 - (verticalXs.at(-1) ?? 0)).toBe(4);
    for (const x of verticalXs) {
      const ys = road.filter((c) => c.x === x).map((c) => c.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(10);
    }
  });

  it('a tower centered in a corridor at its U-turn is 2.5 cells from both runs and 1.5 from the turn', () => {
    const state = game.getState();
    const runs = [4, 9, 14, 19];
    const roadSet = new Set(road.map(at));
    for (let i = 1; i < runs.length; i++) {
      const left = runs[i - 1] ?? 0;
      const right = runs[i] ?? 0;
      // The horizontal run joining these two vertical runs (row 13 at the bottom or row 2 at the top).
      const turnY = [2, 13].find((y) => {
        for (let x = left; x <= right; x++)
          if (!roadSet.has(cellIndex(map, x, y))) return false;
        return true;
      });
      expect(turnY).toBeDefined();
      const ty = turnY ?? 0;
      // Corridor x = left+1 .. right-1 (4 wide): the 2x2 footprint starts at left+2; it sits right
      // next to the turn (rows ty-2..ty-1 for a bottom turn, ty+1..ty+2 for a top turn).
      const pos = { x: left + 2, y: ty === 13 ? ty - 2 : ty + 1 };
      expect(validatePlacement(state, 0, 'human-archer', pos)).toBeNull();
      const c = towerCenter(pos);
      const dist = (x: number, y: number) =>
        Math.sqrt((c.x - x) * (c.x - x) + (c.y - y) * (c.y - y));
      expect(dist(left + 0.5, c.y)).toBe(2.5);
      expect(dist(right + 0.5, c.y)).toBe(2.5);
      expect(dist(c.x, ty + 0.5)).toBe(1.5);
      // e.g. corridor 1: tower (6,11), center (7,12), road cells (4.5,12.5), (9.5,12.5), (7,13.5).
      const range = getTowerLevel('human-archer', 1).range;
      for (const [x, y] of [
        [left + 0.5, ty === 13 ? ty - 0.5 : ty + 1.5],
        [right + 0.5, ty === 13 ? ty - 0.5 : ty + 1.5],
        [c.x, ty + 0.5],
      ] as const) {
        expect(dist(x, y)).toBeLessThanOrEqual(range);
      }
    }
  });

  it('only ground is buildable: road and rocks are CellBlocked, ground next to the road is fine', () => {
    const state = game.getState();
    expect(validatePlacement(state, 0, 'human-archer', { x: 3, y: 5 })).toBe(
      'CellBlocked',
    ); // touches road x=4
    expect(validatePlacement(state, 0, 'human-archer', { x: 0, y: 8 })).toBe(
      'CellBlocked',
    ); // rock (1,9)
    expect(
      validatePlacement(state, 0, 'human-archer', { x: 5, y: 5 }),
    ).toBeNull(); // right next to the road
    expect(
      validatePlacement(state, 0, 'human-archer', { x: 2, y: 3 }),
    ).toBeNull();
    // No tower position can ever block the road.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        expect(validatePlacement(state, 0, 'human-archer', { x, y })).not.toBe(
          'BlocksPath',
        );
      }
    }
  });
});

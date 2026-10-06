import { computeFlowField } from './flowfield.js';
import { createGame } from './game.js';
import { cellIndex, footprintCells } from './grid.js';
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
    // The map-blocked decoration cell is solid too.
    expect(lane?.flowField.dist[cellIndex(OPEN_MAP, 4, 4)]).toBe(-1);
  });
});

import {
  TILE_H,
  TILE_W,
  depthFor,
  footprintContains,
  footprintTopLeftForCursor,
  gridToScreen,
  isoRadiusPx,
  laneScreenBounds,
  screenToGrid,
  towerAnchor,
} from './iso.js';

describe('iso', () => {
  it('projects known points', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(gridToScreen(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
    expect(gridToScreen(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 });
    expect(gridToScreen(1, 1)).toEqual({ x: 0, y: TILE_H });
    expect(gridToScreen(0.5, 0.5)).toEqual({ x: 0, y: TILE_H / 2 });
    expect(gridToScreen(24, 16)).toEqual({ x: 8 * 16, y: 40 * 8 });
  });

  it('round-trips grid -> screen -> grid', () => {
    for (const [x, y] of [
      [0, 0],
      [3.25, 7.75],
      [-2, 5],
      [23.5, 15.5],
      [0.1, 12.9],
    ] as const) {
      const s = gridToScreen(x, y);
      const g = screenToGrid(s.x, s.y);
      expect(g.x).toBeCloseTo(x, 10);
      expect(g.y).toBeCloseTo(y, 10);
    }
  });

  it('round-trips screen -> grid -> screen', () => {
    for (const [sx, sy] of [
      [0, 0],
      [100, 37],
      [-64, 200],
    ] as const) {
      const g = screenToGrid(sx, sy);
      const s = gridToScreen(g.x, g.y);
      expect(s.x).toBeCloseTo(sx, 10);
      expect(s.y).toBeCloseTo(sy, 10);
    }
  });

  it('writes into the provided output object', () => {
    const out = { x: 0, y: 0 };
    expect(gridToScreen(2, 1, out)).toBe(out);
    expect(screenToGrid(10, 10, out)).toBe(out);
  });

  it('uses the anchor screen y as depth', () => {
    expect(depthFor(3, 4)).toBe(gridToScreen(3, 4).y);
    expect(depthFor(5, 5)).toBeGreaterThan(depthFor(5, 4));
  });

  it('centers the 2x2 footprint on the cursor', () => {
    // Cursor near the corner shared by cells (4,4), (5,4), (4,5), (5,5) -> top-left (4,4).
    expect(footprintTopLeftForCursor(5.1, 4.9)).toEqual({ x: 4, y: 4 });
    expect(footprintTopLeftForCursor(5.4, 5.4)).toEqual({ x: 4, y: 4 });
    expect(footprintTopLeftForCursor(5.6, 5.6)).toEqual({ x: 5, y: 5 });
    // The footprint center matches the rounded cursor.
    const tl = footprintTopLeftForCursor(9.3, 2.7);
    expect(towerAnchor(tl)).toEqual({ x: 9, y: 3 });
  });

  it('tests footprint membership', () => {
    const pos = { x: 4, y: 6 };
    expect(footprintContains(pos, 4, 6)).toBe(true);
    expect(footprintContains(pos, 5, 7)).toBe(true);
    expect(footprintContains(pos, 6, 7)).toBe(false);
    expect(footprintContains(pos, 4, 5)).toBe(false);
  });

  it('computes the projected range radius and lane bounds', () => {
    // A point at distance r along the grid diagonal (1,-1) lands on the horizontal axis.
    const r = 3;
    const p = gridToScreen(r / Math.SQRT2, -r / Math.SQRT2);
    expect(p.x).toBeCloseTo(isoRadiusPx(r), 10);
    expect(p.y).toBeCloseTo(0, 10);
    expect(laneScreenBounds(24, 16)).toEqual({
      minX: -256,
      maxX: 384,
      minY: 0,
      maxY: 320,
    });
  });
});

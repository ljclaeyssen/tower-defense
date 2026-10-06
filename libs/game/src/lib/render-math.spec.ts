import type { EntityId } from '@td/shared';
import {
  fitZoom,
  hpColor,
  indexById,
  interpolatePos,
  isTypingTarget,
  mixColor,
  numbersEqual,
  rectsOverlap,
  scrollForZoomAround,
  viewToWorld,
} from './render-math.js';

describe('render-math', () => {
  it('interpolates between previous and current positions', () => {
    const out = { x: 0, y: 0 };
    expect(interpolatePos({ x: 0, y: 0 }, { x: 2, y: 4 }, 0.5, out)).toEqual({
      x: 1,
      y: 2,
    });
    expect(interpolatePos({ x: 0, y: 0 }, { x: 2, y: 4 }, 0, out)).toEqual({
      x: 0,
      y: 0,
    });
    expect(interpolatePos({ x: 0, y: 0 }, { x: 2, y: 4 }, 1, out)).toEqual({
      x: 2,
      y: 4,
    });
    // Alpha is clamped.
    expect(interpolatePos({ x: 0, y: 0 }, { x: 2, y: 4 }, 3, out)).toEqual({
      x: 2,
      y: 4,
    });
  });

  it('renders new entities at their current position', () => {
    expect(
      interpolatePos(undefined, { x: 5, y: 6 }, 0.25, { x: 0, y: 0 }),
    ).toEqual({ x: 5, y: 6 });
  });

  it('matches entities by id with a reusable index', () => {
    const map = new Map<EntityId, { id: EntityId; v: number }>();
    indexById(
      [
        { id: 1, v: 10 },
        { id: 3, v: 30 },
      ],
      map,
    );
    expect(map.get(3)?.v).toBe(30);
    indexById([{ id: 2, v: 20 }], map);
    expect(map.size).toBe(1);
    expect(map.has(1)).toBe(false);
  });

  it('blends HP colors from red to green', () => {
    expect(hpColor(1)).toBe(0x22c55e);
    expect(hpColor(0)).toBe(0xef4444);
    expect(hpColor(-1)).toBe(0xef4444);
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it('detects rectangle overlap', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectsOverlap(a, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(
      true,
    );
    expect(rectsOverlap(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(
      false,
    );
  });

  it('compares numeric arrays', () => {
    const a = [1, 2, 3];
    expect(numbersEqual(a, a)).toBe(true);
    expect(numbersEqual(a, [1, 2, 3])).toBe(true);
    expect(numbersEqual(a, [1, 2, 4])).toBe(false);
    expect(numbersEqual(a, [1, 2])).toBe(false);
  });

  it('converts viewport pixels to world points like Phaser', () => {
    const cam = { scrollX: 100, scrollY: 50, zoom: 2, width: 800, height: 600 };
    // The viewport center shows scroll + origin regardless of zoom.
    expect(viewToWorld(cam, 400, 300, { x: 0, y: 0 })).toEqual({
      x: 500,
      y: 350,
    });
    expect(viewToWorld(cam, 0, 0, { x: 0, y: 0 })).toEqual({ x: 300, y: 200 });
  });

  it('keeps the world point under the cursor fixed when zooming', () => {
    const cam = { scrollX: 100, scrollY: 50, zoom: 1, width: 800, height: 600 };
    const before = viewToWorld(cam, 123, 456, { x: 0, y: 0 });
    const scroll = scrollForZoomAround(cam, 123, 456, 2.5);
    const after = viewToWorld({ ...cam, ...scroll, zoom: 2.5 }, 123, 456, {
      x: 0,
      y: 0,
    });
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('fits content in the viewport within the zoom limits', () => {
    expect(fitZoom(1000, 500, 500, 250, 0.5, 3, 1)).toBe(2);
    expect(fitZoom(1000, 500, 100, 50, 0.5, 3, 1)).toBe(3);
    expect(fitZoom(0, 0, 100, 50, 0.5, 3)).toBe(1);
  });

  it('recognizes text inputs as typing targets', () => {
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(
      true,
    );
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

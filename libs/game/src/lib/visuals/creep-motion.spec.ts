import { gridToScreen } from '../iso.js';
import {
  CREEP_HP_BAR_Y,
  FLAT_SCALE_Y,
  WALK_CELLS_PER_FRAME,
  advanceWalk,
  createWalkState,
  creepExtents,
  groundAngle,
  screenAngle,
  walkFrameIndex,
} from './creep-motion.js';

describe('walk cycle', () => {
  it('advances one frame per quarter cell and loops over 4 frames', () => {
    expect(WALK_CELLS_PER_FRAME).toBe(0.25);
    expect(walkFrameIndex(0)).toBe(0);
    expect(walkFrameIndex(0.24)).toBe(0);
    expect(walkFrameIndex(0.25)).toBe(1);
    expect(walkFrameIndex(0.6)).toBe(2);
    expect(walkFrameIndex(0.9)).toBe(3);
    expect(walkFrameIndex(1.0)).toBe(0);
    expect(walkFrameIndex(1.3)).toBe(1);
  });

  it('accumulates the distance between rendered positions, not time', () => {
    const walk = createWalkState();
    expect(advanceWalk(walk, 2, 3)).toBe(0); // first position: no distance yet
    expect(advanceWalk(walk, 2.1, 3)).toBe(0);
    expect(advanceWalk(walk, 2.3, 3)).toBe(1);
    // Standing still (e.g. paused game, many frames): the frame does not change.
    for (let i = 0; i < 10; i++) expect(advanceWalk(walk, 2.3, 3)).toBe(1);
    // Diagonal step of length 0.5 (0.3, 0.4).
    expect(advanceWalk(walk, 2.6, 3.4)).toBe(3);
    expect(walk.distance).toBeCloseTo(0.8, 10);
  });

  it('is the same however the path is sampled (frame rate independent)', () => {
    const coarse = createWalkState();
    const fine = createWalkState();
    advanceWalk(coarse, 0, 0);
    advanceWalk(fine, 0, 0);
    advanceWalk(coarse, 1.1, 0);
    for (let i = 1; i <= 11; i++) advanceWalk(fine, i / 10, 0);
    expect(walkFrameIndex(fine.distance)).toBe(walkFrameIndex(coarse.distance));
  });
});

describe('creep facing', () => {
  it('returns null for a zero direction', () => {
    expect(groundAngle(0, 0)).toBeNull();
    expect(screenAngle(0, 0)).toBeNull();
  });

  it('turns the +x sprite in the ground plane: grid axes are diagonals', () => {
    expect(groundAngle(1, 0)).toBeCloseTo(Math.PI / 4); // screen down-right
    expect(groundAngle(0, 1)).toBeCloseTo((3 * Math.PI) / 4); // down-left
    expect(groundAngle(-1, 0)).toBeCloseTo((-3 * Math.PI) / 4); // up-left
    expect(groundAngle(0, -1)).toBeCloseTo(-Math.PI / 4); // up-right
    expect(groundAngle(1, 1)).toBeCloseTo(Math.PI / 2); // straight down the screen
  });

  it('heads along the projected direction once flattened (rotate, then scaleY 0.5)', () => {
    const dirs: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [0.6, 0.8],
      [-0.28, 0.96],
    ];
    for (const [dx, dy] of dirs) {
      const a = groundAngle(dx, dy) ?? NaN;
      const heading = { x: Math.cos(a), y: Math.sin(a) * FLAT_SCALE_Y };
      const s = gridToScreen(dx, dy);
      // Parallel and same orientation.
      expect(heading.x * s.y - heading.y * s.x).toBeCloseTo(0, 10);
      expect(heading.x * s.x + heading.y * s.y).toBeGreaterThan(0);
      expect(Math.atan2(heading.y, heading.x)).toBeCloseTo(
        screenAngle(dx, dy) ?? NaN,
        10,
      );
    }
  });
});

describe('creepExtents', () => {
  it('covers the flattened body, the shadow and the HP bar', () => {
    const e = creepExtents(
      { width: 16, height: 16 },
      { width: 16, height: 8 },
      true,
    );
    expect(e.left).toBe(-8);
    expect(e.right).toBe(8);
    expect(e.top).toBeLessThan(CREEP_HP_BAR_Y);
    expect(e.bottom).toBe(5);
  });

  it('uses the upright size of a non-flat body', () => {
    const e = creepExtents(
      { width: 14, height: 30 },
      { width: 14, height: 6 },
      false,
    );
    expect(e.left).toBe(-7);
    expect(e.top).toBe(-4 - 15);
    expect(e.bottom).toBe(11);
  });
});

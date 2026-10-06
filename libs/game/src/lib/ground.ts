/**
 * Ground tile selection (pure, no Phaser).
 */
import type { LaneState } from '@td/shared';

/**
 * Ground tile kinds. Grass = buildable ground (two alternating tones), path = the creep road (two
 * alternating dirt tones), rock = decorative solid cell, spawn/exit = highlighted road ends.
 */
export const GROUND_KINDS = [
  'grass-a',
  'grass-b',
  'path-a',
  'path-b',
  'rock',
  'spawn',
  'exit',
] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];

/** Ground tile of cell (x, y): spawn/exit first, then the cell kind, alternating tones in a checkerboard. */
export function groundKindAt(
  lane: LaneState,
  x: number,
  y: number,
): GroundKind {
  if (x === lane.spawn.x && y === lane.spawn.y) return 'spawn';
  if (x === lane.exit.x && y === lane.exit.y) return 'exit';
  const even = (x + y) % 2 === 0;
  switch (lane.cells[y * lane.width + x]) {
    case 'path':
      return even ? 'path-a' : 'path-b';
    case 'rock':
      return 'rock';
    default:
      return even ? 'grass-a' : 'grass-b';
  }
}

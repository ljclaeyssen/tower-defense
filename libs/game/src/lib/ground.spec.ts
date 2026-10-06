import { makeLane } from './testing/fake-game.js';
import { groundKindAt } from './ground.js';

describe('groundKindAt', () => {
  // Road: spawn (0,2) -> (3,2) -> (3,3) -> exit (7,3); one rock at (5,0).
  const lane = makeLane(
    {},
    {
      path: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 3 },
        { x: 6, y: 3 },
      ],
      rocks: [{ x: 5, y: 0 }],
    },
  );

  it('builds a road lane where only the road is walkable', () => {
    expect(lane.groundWalkable).toBe(false);
    expect(lane.cells[2 * lane.width + 1]).toBe('path');
    expect(lane.cells[0]).toBe('ground');
    expect(makeLane().groundWalkable).toBe(true);
  });

  it('highlights the spawn and the exit', () => {
    expect(groundKindAt(lane, 0, 2)).toBe('spawn');
    expect(groundKindAt(lane, 7, 3)).toBe('exit');
  });

  it('alternates two tones on the road and on the grass', () => {
    expect(groundKindAt(lane, 2, 2)).toBe('path-a');
    expect(groundKindAt(lane, 1, 2)).toBe('path-b');
    expect(groundKindAt(lane, 0, 0)).toBe('grass-a');
    expect(groundKindAt(lane, 1, 0)).toBe('grass-b');
  });

  it('marks rocks', () => {
    expect(groundKindAt(lane, 5, 0)).toBe('rock');
  });
});

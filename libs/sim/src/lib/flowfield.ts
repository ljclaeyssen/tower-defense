import type { FlowFieldState, GridPos } from '@td/shared';

/** Neighbour order used by the BFS and to pick `next`: up, right, down, left. Never change it. */
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

/**
 * BFS (4-connected) from the exit cell. `dist[i]` = steps to the exit, `next[i]` = the first
 * neighbour (up, right, down, left) whose distance is `dist[i] - 1`. Both are -1 for solid and
 * unreachable cells; `next` is also -1 for the exit itself.
 */
export function computeFlowField(
  width: number,
  height: number,
  exit: GridPos,
  isSolid: (x: number, y: number) => boolean,
): FlowFieldState {
  const n = width * height;
  const dist = new Array<number>(n).fill(-1);
  const next = new Array<number>(n).fill(-1);
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height;
  if (!inside(exit.x, exit.y) || isSolid(exit.x, exit.y)) return { dist, next };

  const exitIndex = exit.y * width + exit.x;
  dist[exitIndex] = 0;
  const queue: number[] = [exitIndex];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head] ?? 0;
    const x = i % width;
    const y = (i - x) / width;
    const d = dist[i] ?? 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (DX[k] ?? 0);
      const ny = y + (DY[k] ?? 0);
      if (!inside(nx, ny)) continue;
      const ni = ny * width + nx;
      if (dist[ni] !== -1 || isSolid(nx, ny)) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  for (let i = 0; i < n; i++) {
    const d = dist[i] ?? -1;
    if (d <= 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (let k = 0; k < 4; k++) {
      const nx = x + (DX[k] ?? 0);
      const ny = y + (DY[k] ?? 0);
      if (!inside(nx, ny)) continue;
      const ni = ny * width + nx;
      if (dist[ni] === d - 1) {
        next[i] = ni;
        break;
      }
    }
  }
  return { dist, next };
}

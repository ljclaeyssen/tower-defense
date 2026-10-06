/** Fixed simulation rate. The sim never reads a real clock; the host calls `step()` at this rate. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Every tower occupies a FOOTPRINT x FOOTPRINT block of fine cells. */
export const TOWER_FOOTPRINT = 2;

export const ticksFromSeconds = (seconds: number): number =>
  Math.round(seconds * TICK_RATE);
export const secondsFromTicks = (ticks: number): number => ticks / TICK_RATE;

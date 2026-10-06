/**
 * Pure helpers of the pierce "back-travel" animation (no Phaser): when a pierce projectile hits, it
 * visibly continues backwards along the road, hop by hop, from the target to each creep behind it.
 */
import type { EntityId } from '@td/shared';

/** Duration of one hop of the chain. */
export const CHAIN_HOP_MS = 90;
/** A whole chain never lasts longer than this, so long chains do not lag behind the sim. */
export const CHAIN_MAX_TOTAL_MS = 400;
/** Beyond this many pending delayed hits (hidden tab, backlog), chains are not animated. */
export const MAX_PENDING_CHAIN_HITS = 200;
/** How long the last position of a destroyed creep view stays available to chains. */
export const GHOST_POSITION_MS = 500;
/** Fade duration of a lightning hop. */
export const BOLT_FADE_MS = 150;

export interface ChainVictim {
  creepId: EntityId;
  damage: number;
}

/**
 * Orders the secondary victims of a pierce hit backwards along the road: increasing `distanceToExit`
 * (nearest follower of the target first). Victims whose distance is unknown go last, by id.
 * Sorts in place and returns the array.
 */
export function orderChainVictims<T extends ChainVictim>(
  victims: T[],
  distanceOf: (creepId: EntityId) => number | undefined,
): T[] {
  return victims.sort((a, b) => {
    const da = distanceOf(a.creepId);
    const db = distanceOf(b.creepId);
    if (da !== undefined && db !== undefined && da !== db) return da - db;
    if (da !== undefined && db === undefined) return -1;
    if (da === undefined && db !== undefined) return 1;
    return a.creepId - b.creepId;
  });
}

/** Hop duration for a chain of `hops` hops: CHAIN_HOP_MS, compressed so the chain fits the cap. */
export function chainHopMs(
  hops: number,
  hopMs = CHAIN_HOP_MS,
  maxTotalMs = CHAIN_MAX_TOTAL_MS,
): number {
  if (hops <= 0) return hopMs;
  return Math.min(hopMs, maxTotalMs / hops);
}

/** Arrival time of hop `k` (1-based) of a chain started at `start`. */
export const hopArrival = (start: number, k: number, hopMs: number): number =>
  start + k * hopMs;

/**
 * Items released at a due time (delayed damage numbers). Items are kept sorted by due time; pushes
 * are usually in increasing order, so insertion scans from the end.
 */
export class DueQueue<T> {
  private readonly dues: number[] = [];
  private readonly items: T[] = [];

  get size(): number {
    return this.items.length;
  }

  push(due: number, item: T): void {
    let i = this.dues.length;
    while (i > 0 && (this.dues[i - 1] ?? 0) > due) i--;
    this.dues.splice(i, 0, due);
    this.items.splice(i, 0, item);
  }

  /** Calls `fn` for every item due at `now` (in due order) and removes them. */
  popDue(now: number, fn: (item: T) => void): void {
    let n = 0;
    while (n < this.dues.length && (this.dues[n] ?? Infinity) <= now) n++;
    if (n === 0) return;
    const released = this.items.splice(0, n);
    this.dues.splice(0, n);
    for (const item of released) fn(item);
  }

  /** Releases everything now (backlog / teardown). */
  flush(fn: (item: T) => void): void {
    const released = this.items.splice(0);
    this.dues.length = 0;
    for (const item of released) fn(item);
  }
}

/**
 * Seeded PRNG (mulberry32). Only 32-bit integer operations, so the sequence is identical on every
 * JS engine. The whole generator state is a single uint32, which is fed into the state hash.
 *
 * Phase 1 gameplay is fully deterministic without randomness (no crits, no random spawns), so the
 * generator is created, stored and hashed but not consumed yet. Future random mechanics MUST draw
 * from this generator (never from Math.random) and always in the deterministic tick order.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). `n` must be a positive integer. */
  nextInt(n: number): number;
  /** Raw uint32 state (for hashing and snapshots). */
  getState(): number;
  setState(state: number): void;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const nextUint32 = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next: () => nextUint32() / 4294967296,
    nextInt: (n: number) => Math.floor((nextUint32() / 4294967296) * n),
    getState: () => a >>> 0,
    setState: (state: number) => {
      a = state >>> 0;
    },
  };
}

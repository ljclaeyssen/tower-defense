import {
  CHAIN_HOP_MS,
  CHAIN_MAX_TOTAL_MS,
  DueQueue,
  chainHopMs,
  hopArrival,
  orderChainVictims,
} from './pierce-chain.js';

describe('orderChainVictims', () => {
  it('orders victims backwards along the road (increasing distanceToExit)', () => {
    const distances = new Map([
      [5, 12.5],
      [3, 10.2],
      [9, 11],
    ]);
    // The sim emits victims by id.
    const victims = [
      { creepId: 3, damage: 1 },
      { creepId: 5, damage: 1 },
      { creepId: 9, damage: 1 },
    ];
    orderChainVictims(victims, (id) => distances.get(id));
    expect(victims.map((v) => v.creepId)).toEqual([3, 9, 5]);
  });

  it('puts unknown distances last, by id, and breaks ties by id', () => {
    const distances = new Map([
      [8, 4],
      [2, 4],
    ]);
    const victims = [7, 8, 1, 2].map((creepId) => ({ creepId, damage: 0 }));
    orderChainVictims(victims, (id) => distances.get(id));
    expect(victims.map((v) => v.creepId)).toEqual([2, 8, 1, 7]);
  });
});

describe('chain timing', () => {
  it('uses the nominal hop duration for short chains', () => {
    expect(chainHopMs(1)).toBe(CHAIN_HOP_MS);
    expect(chainHopMs(4)).toBe(CHAIN_HOP_MS);
  });

  it('compresses long chains so they never exceed the cap', () => {
    const hops = 10;
    const hop = chainHopMs(hops);
    expect(hop * hops).toBeLessThanOrEqual(CHAIN_MAX_TOTAL_MS);
    expect(hopArrival(1000, hops, hop)).toBe(1000 + CHAIN_MAX_TOTAL_MS);
  });

  it('schedules hop k at start + k * hop', () => {
    expect(hopArrival(500, 1, 90)).toBe(590);
    expect(hopArrival(500, 3, 90)).toBe(770);
  });
});

describe('DueQueue', () => {
  it('releases items when due, in due order', () => {
    const q = new DueQueue<string>();
    q.push(200, 'b');
    q.push(100, 'a');
    q.push(300, 'c');
    const out: string[] = [];
    q.popDue(99, (x) => out.push(x));
    expect(out).toEqual([]);
    q.popDue(200, (x) => out.push(x));
    expect(out).toEqual(['a', 'b']);
    expect(q.size).toBe(1);
  });

  it('flushes everything at once', () => {
    const q = new DueQueue<number>();
    q.push(10, 1);
    q.push(20, 2);
    const out: number[] = [];
    q.flush((x) => out.push(x));
    expect(out).toEqual([1, 2]);
    expect(q.size).toBe(0);
  });
});

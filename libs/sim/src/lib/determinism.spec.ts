import type { Command, FactionId, GameEvent, PlayerId } from '@td/shared';
import type { Game } from './api.js';
import { createGame } from './game.js';
import { createHasher } from './hash.js';
import { createRng } from './prng.js';
import { pveConfig, stepN } from './testing.js';

/** Scripted commands keyed by the tick before which they are applied: one human tower of each role. */
const SCRIPT: ReadonlyArray<readonly [number, Command]> = [
  [0, { type: 'PlaceTower', towerType: 'human-archer', pos: { x: 6, y: 11 } }],
  [
    0,
    { type: 'PlaceTower', towerType: 'human-frostmage', pos: { x: 6, y: 8 } },
  ],
  [
    0,
    {
      type: 'PlaceTower',
      towerType: 'human-stormcaller',
      pos: { x: 11, y: 3 },
    },
  ], // NotEnoughGold
  [250, { type: 'StartWave' }],
  [
    650,
    {
      type: 'PlaceTower',
      towerType: 'human-stormcaller',
      pos: { x: 11, y: 3 },
    },
  ],
  [
    1000,
    { type: 'PlaceTower', towerType: 'human-cannon', pos: { x: 11, y: 6 } },
  ], // NotEnoughGold
  [1100, { type: 'UpgradeTower', towerId: 1 }],
  [1200, { type: 'SellTower', towerId: 2 }],
  [
    1205,
    { type: 'PlaceTower', towerType: 'human-frostmage', pos: { x: 16, y: 8 } },
  ],
  [1400, { type: 'UpgradeTower', towerId: 1 }], // NotEnoughGold
  [1600, { type: 'UpgradeTower', towerId: 2 }], // TowerNotFound (sold)
  [
    1750,
    { type: 'PlaceTower', towerType: 'human-cannon', pos: { x: 1, y: 10 } },
  ],
];

function runScript(seed: number): {
  hashes: number[];
  events: GameEvent[];
  game: Game;
} {
  const game = createGame(pveConfig(), seed);
  const hashes: number[] = [];
  const events: GameEvent[] = [];
  for (let tick = 0; tick < 2000; tick++) {
    for (const [at, command] of SCRIPT) {
      if (at === tick) game.apply(command, 0 as PlayerId);
    }
    if (tick % 100 === 0) hashes.push(game.hash());
    events.push(...stepN(game, 1));
  }
  hashes.push(game.hash());
  return { hashes, events, game };
}

describe('determinism', () => {
  it('same seed + same commands => same hashes every 100 ticks and same event streams', () => {
    const a = runScript(42);
    const b = runScript(42);
    expect(a.hashes).toEqual(b.hashes);
    expect(a.events).toEqual(b.events);
    expect(a.game.getState()).toEqual(b.game.getState());
    // The script actually exercised the game.
    expect(new Set(a.hashes).size).toBe(a.hashes.length);
    const types = new Set(a.events.map((e) => e.type));
    for (const t of [
      'TowerPlaced',
      'TowerUpgraded',
      'TowerSold',
      'CreepKilled',
      'CommandRejected',
      'CreepSlowed',
      'WaveStarted',
    ] as const) {
      expect(types.has(t)).toBe(true);
    }
    // Every attack kind fired, and pierce/burst produced secondary hits.
    const kinds = new Set(
      a.events.flatMap((e) =>
        e.type === 'ProjectileFired' ? [e.projectile.kind] : [],
      ),
    );
    expect([...kinds].sort()).toEqual(['burst', 'pierce', 'single', 'slow']);
    expect(a.events.some((e) => e.type === 'CreepHit' && !e.primary)).toBe(
      true,
    );
  });

  it('a different seed gives a different hash (rng state is hashed)', () => {
    expect(createGame(pveConfig(), 1).hash()).not.toBe(
      createGame(pveConfig(), 2).hash(),
    );
    const a = runScript(42);
    const b = runScript(43);
    expect(a.events).toEqual(b.events); // phase 1 gameplay does not consume randomness
    expect(a.hashes.every((h, i) => h !== b.hashes[i])).toBe(true);
  });
});

describe('hash and snapshots', () => {
  it('hash() does not change between getState() calls without a step', () => {
    const game = createGame(pveConfig(), 7);
    stepN(game, 350);
    const h = game.hash();
    const s1 = game.getState();
    const s2 = game.getState();
    expect(s2).toBe(s1);
    expect(game.hash()).toBe(h);
    expect(game.hash()).toBe(h);
    game.step();
    expect(game.hash()).not.toBe(h);
  });

  it('keeps previous snapshots intact for interpolation', () => {
    const game = createGame(pveConfig(), 7);
    stepN(game, 320);
    const prev = game.getState();
    const prevCreeps = JSON.parse(
      JSON.stringify(prev.lanes[0]?.creeps),
    ) as unknown;
    game.step();
    const curr = game.getState();
    expect(curr).not.toBe(prev);
    expect(curr.tick).toBe(prev.tick + 1);
    expect(prev.lanes[0]?.creeps).toEqual(prevCreeps);
    expect(curr.lanes[0]?.creeps[0]?.pos).not.toEqual(
      prev.lanes[0]?.creeps[0]?.pos,
    );
  });

  it('getState is invalidated by a successful apply only', () => {
    const game = createGame(pveConfig(), 7);
    const s = game.getState();
    game.apply(
      { type: 'PlaceTower', towerType: 'human-archer', pos: { x: 23, y: 0 } },
      0,
    );
    expect(game.getState()).toBe(s);
    game.apply(
      { type: 'PlaceTower', towerType: 'human-archer', pos: { x: 4, y: 0 } },
      0,
    );
    expect(game.getState()).not.toBe(s);
    expect(game.getState().lanes[0]?.towers).toHaveLength(1);
    expect(s.lanes[0]?.towers).toHaveLength(0);
  });

  it('createGame rejects player ids that differ from their index and unknown factions', () => {
    expect(() =>
      createGame(
        {
          mode: 'pve',
          players: [{ id: 1, team: 'blue', faction: 'humans' }],
          mapId: 'basic',
        },
        1,
      ),
    ).toThrow();
    expect(() =>
      createGame(
        {
          mode: 'pve',
          players: [{ id: 0, team: 'blue', faction: 'goblins' as FactionId }],
          mapId: 'basic',
        },
        1,
      ),
    ).toThrow();
  });

  it('players keep their faction in the snapshot and the faction is hashed', () => {
    const humans = createGame(pveConfig(undefined, 'humans'), 1);
    const orcs = createGame(pveConfig(undefined, 'orcs'), 1);
    expect(humans.getState().players[0]?.faction).toBe('humans');
    expect(orcs.getState().players[0]?.faction).toBe('orcs');
    expect(humans.hash()).not.toBe(orcs.hash());
  });
});

describe('prng (mulberry32)', () => {
  it('is reproducible and restorable', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    for (const x of seqA) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const saved = a.getState();
    const next = [a.next(), a.nextInt(10)];
    a.setState(saved);
    expect([a.next(), a.nextInt(10)]).toEqual(next);
    expect(createRng(124).next()).not.toBe(seqA[0]);
  });

  it('nextInt stays within [0, n)', () => {
    const rng = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
});

describe('FNV-1a hasher', () => {
  it('matches the reference FNV-1a of known bytes and quantises floats', () => {
    const empty = createHasher();
    expect(empty.digest()).toBe(0x811c9dc5);
    const a = createHasher();
    a.addFloat(0.1 + 0.2);
    const b = createHasher();
    b.addFloat(0.3);
    expect(a.digest()).toBe(b.digest());
    const c = createHasher();
    c.addInt(1);
    const d = createHasher();
    d.addInt(2);
    expect(c.digest()).not.toBe(d.digest());
    expect(c.digest()).toBeGreaterThanOrEqual(0);
  });
});

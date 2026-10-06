import { getTowerLevel, type GameEvent, type TowerTypeId } from '@td/shared';
import { spawnCreep, updateCreeps } from './creeps.js';
import { createGame, createWorld } from './game.js';
import {
  allocId,
  type SimCreep,
  type SimLane,
  type SimProjectile,
  type World,
} from './model.js';
import { validatePlacement } from './placement.js';
import { resolveImpact } from './projectiles.js';
import {
  LONG_MAP,
  OPEN_MAP,
  placeTower,
  pveConfig,
  pvpConfig,
} from './testing.js';

/** World with a straight road on row 2 (LONG_MAP) and an empty lane 0. */
function setup(): { world: World; lane: SimLane } {
  const world = createWorld(pveConfig(LONG_MAP), 1);
  const lane = world.lanes[0];
  if (!lane) throw new Error('no lane');
  return { world, lane };
}

/** Spawns a beetle and moves it to (x, y) with the given distanceToExit / hp (ids increase). */
function creep(
  world: World,
  lane: SimLane,
  opts: { x?: number; y?: number; d?: number; hp?: number } = {},
): SimCreep {
  spawnCreep(world, lane, {
    creepType: 'beetle',
    waveIndex: 0,
    hpMultiplier: 1,
    dueTick: 0,
    fromWave: false,
  });
  const c = lane.creeps[lane.creeps.length - 1];
  if (!c) throw new Error('spawn failed');
  c.x = opts.x ?? c.x;
  c.y = opts.y ?? c.y;
  c.distanceToExit = opts.d ?? c.distanceToExit;
  c.hp = opts.hp ?? c.hp;
  return c;
}

/** A projectile of `type` at `level` aimed at `target` (as fired by tower id 999). */
function projectile(
  world: World,
  type: TowerTypeId,
  level: number,
  target: SimCreep,
): SimProjectile {
  const def = getTowerLevel(type, level);
  return {
    id: allocId(world),
    playerId: 0,
    sourceTowerId: 999,
    targetId: target.id,
    x: target.x,
    y: target.y,
    speed: def.projectile.speed,
    damage: def.damage,
    attack: def.attack,
    kind: def.attack.kind,
    visual: def.projectile.visual,
  };
}

const hits = (events: GameEvent[]) =>
  events.flatMap((e) => (e.type === 'CreepHit' ? [e] : []));

describe('pierce impact', () => {
  const def = getTowerLevel('human-stormcaller', 1);
  const attack = def.attack.kind === 'pierce' ? def.attack : null;

  it('hits the target, then only creeps behind it within behindCells, at the ratio, in id order', () => {
    expect(attack).not.toBeNull();
    const behind = attack?.behindCells ?? 0;
    const { world, lane } = setup();
    // Ids are created out of distance order on purpose.
    const far = creep(world, lane, { d: 5 + behind + 0.001 }); // just beyond the reach
    const edge = creep(world, lane, { d: 5 + behind }); // exactly at the reach (included)
    const target = creep(world, lane, { d: 5 });
    const ahead = creep(world, lane, { d: 4.5 }); // ahead of the target: never hit
    const near = creep(world, lane, { d: 5.5 });
    world.events = [];
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-stormcaller', 1, target),
      target,
    );

    const secondary = Math.max(
      1,
      Math.floor(def.damage * (attack?.behindRatio ?? 0)),
    );
    expect(
      hits(world.events).map((h) => [h.creepId, h.damage, h.primary]),
    ).toEqual([
      [target.id, def.damage, true],
      [edge.id, secondary, false],
      [near.id, secondary, false],
    ]);
    expect(far.hp).toBe(far.maxHp);
    expect(ahead.hp).toBe(ahead.maxHp);
  });

  it('kills in a deterministic order (target first, then secondaries by id), each creep hit once', () => {
    const { world, lane } = setup();
    const a = creep(world, lane, { d: 6, hp: 3 });
    const target = creep(world, lane, { d: 5, hp: 1 });
    const b = creep(world, lane, { d: 5.2, hp: 3 });
    world.events = [];
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-stormcaller', 1, target),
      target,
    );
    const killed = world.events.flatMap((e) =>
      e.type === 'CreepKilled' ? [e.creepId] : [],
    );
    expect(killed).toEqual([target.id, a.id, b.id]);
    const perCreep = hits(world.events).map((h) => h.creepId);
    expect(new Set(perCreep).size).toBe(perCreep.length);
    expect(lane.creeps).toHaveLength(0);
    const bounties = world.events.filter(
      (e) => e.type === 'GoldChanged' && e.reason === 'kill',
    );
    expect(bounties).toHaveLength(3);
  });
});

describe('burst impact', () => {
  const def = getTowerLevel('human-cannon', 1);
  const attack = def.attack.kind === 'burst' ? def.attack : null;

  it('splashes every creep within splashRadius of the target for damage * splashRatio', () => {
    expect(attack).not.toBeNull();
    const r = attack?.splashRadius ?? 0;
    const { world, lane } = setup();
    const target = creep(world, lane, { x: 5.5, y: 2.5 });
    const inside = creep(world, lane, { x: 5.5 + r, y: 2.5 }); // exactly on the radius
    const diagonal = creep(world, lane, { x: 5.5 + r * 0.6, y: 2.5 + r * 0.6 }); // ~0.85 r
    const outside = creep(world, lane, { x: 5.5 + r + 0.01, y: 2.5 });
    world.events = [];
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-cannon', 1, target),
      target,
    );
    const splash = Math.max(
      1,
      Math.floor(def.damage * (attack?.splashRatio ?? 0)),
    );
    expect(
      hits(world.events).map((h) => [h.creepId, h.damage, h.primary]),
    ).toEqual([
      [target.id, def.damage, true],
      [inside.id, splash, false],
      [diagonal.id, splash, false],
    ]);
    expect(outside.hp).toBe(outside.maxHp);
  });

  it('uses the target position at impact time even when the target dies', () => {
    const { world, lane } = setup();
    const target = creep(world, lane, { x: 9.5, y: 2.5, hp: 1 });
    const next = creep(world, lane, { x: 9.9, y: 2.5 });
    world.events = [];
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-cannon', 1, target),
      target,
    );
    expect(world.events.map((e) => e.type)).toEqual([
      'CreepHit',
      'GoldChanged',
      'CreepKilled',
      'CreepHit',
    ]);
    expect(next.hp).toBeLessThan(next.maxHp);
  });
});

describe('slow impact', () => {
  const l1 = getTowerLevel('human-frostmage', 1);
  const l2 = getTowerLevel('human-frostmage', 2);
  const slowOf = (def: typeof l1) =>
    def.attack.kind === 'slow' ? def.attack : { factor: 1, durationTicks: 0 };

  it('damages, then applies the strongest factor and refreshes the duration', () => {
    const { world, lane } = setup();
    const target = creep(world, lane);
    world.events = [];
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-frostmage', 1, target),
      target,
    );
    expect(target.hp).toBe(target.maxHp - l1.damage);
    expect(target.slowFactor).toBe(slowOf(l1).factor);
    expect(target.slowTicks).toBe(slowOf(l1).durationTicks);
    expect(world.events.at(-1)).toEqual({
      type: 'CreepSlowed',
      playerId: 0,
      creepId: target.id,
      factor: slowOf(l1).factor,
      ticks: slowOf(l1).durationTicks,
    });

    // A stronger slow wins and its longer duration applies.
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-frostmage', 2, target),
      target,
    );
    expect(target.slowFactor).toBe(slowOf(l2).factor);
    expect(target.slowTicks).toBe(slowOf(l2).durationTicks);

    // A weaker slow keeps the strongest factor; its duration only counts if it is longer.
    target.slowTicks = 5;
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-frostmage', 1, target),
      target,
    );
    expect(target.slowFactor).toBe(slowOf(l2).factor);
    expect(target.slowTicks).toBe(slowOf(l1).durationTicks);
  });

  it('does not slow a creep killed by the hit', () => {
    const { world, lane } = setup();
    const target = creep(world, lane, { hp: 1 });
    world.events = [];
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-frostmage', 1, target),
      target,
    );
    expect(world.events.some((e) => e.type === 'CreepSlowed')).toBe(false);
  });

  it('reduces movement while active, then expires back to full speed', () => {
    const { world, lane } = setup();
    const target = creep(world, lane);
    resolveImpact(
      world,
      lane,
      projectile(world, 'human-frostmage', 1, target),
      target,
    );
    const { factor, durationTicks } = slowOf(l1);
    let x = target.x;
    for (let t = 0; t < durationTicks; t++) {
      updateCreeps(world);
      expect(target.x - x).toBeCloseTo(target.speed * factor, 9);
      expect(target.slowTicks).toBe(durationTicks - t - 1);
      x = target.x;
    }
    expect(target.slowFactor).toBe(1);
    updateCreeps(world);
    expect(target.x - x).toBeCloseTo(target.speed, 9);
  });
});

describe('factions', () => {
  it('rejects towers of another faction with WrongFaction (apply and validatePlacement)', () => {
    const game = createGame(pvpConfig(OPEN_MAP, ['elves', 'humans']), 1);
    expect(placeTower(game, 'human-archer', { x: 2, y: 0 }, 0)).toEqual({
      ok: false,
      reason: 'WrongFaction',
    });
    expect(
      validatePlacement(game.getState(), 0, 'human-archer', { x: 2, y: 0 }),
    ).toBe('WrongFaction');
    // WrongFaction comes right after UnknownType, before OutOfBounds.
    expect(
      validatePlacement(game.getState(), 0, 'human-archer', { x: 99, y: 0 }),
    ).toBe('WrongFaction');
    expect(placeTower(game, 'elf-ranger', { x: 2, y: 0 }, 0)).toEqual({
      ok: true,
    });
    expect(placeTower(game, 'human-archer', { x: 2, y: 0 }, 1)).toEqual({
      ok: true,
    });
    expect(
      validatePlacement(game.getState(), 1, 'elf-ranger', { x: 2, y: 2 }),
    ).toBe('WrongFaction');
  });

  it('projectiles carry the attack kind and visual of the firing level', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    placeTower(game, 'human-frostmage', { x: 2, y: 0 });
    game.apply({ type: 'SendCreeps', creepType: 'beetle', count: 1 }, 1);
    game.step();
    const fired = game.drainEvents().find((e) => e.type === 'ProjectileFired');
    const def = getTowerLevel('human-frostmage', 1);
    expect(fired?.type === 'ProjectileFired' && fired.projectile).toMatchObject(
      {
        kind: 'slow',
        visual: def.projectile.visual,
        speed: def.projectile.speed,
        damage: def.damage,
      },
    );
  });
});

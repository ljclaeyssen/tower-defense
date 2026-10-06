import { CREEPS, ECONOMY, TOWERS, type GameEvent } from '@td/shared';
import type { Game } from './api.js';
import { createGame } from './game.js';
import { cellIndex, footprintCells } from './grid.js';
import {
  LONG_MAP,
  OPEN_MAP,
  place,
  pveConfig,
  pvpConfig,
  sendToLane0,
  stepN,
} from './testing.js';

const LEVELS = TOWERS.archer.levels;
const cost = (level: number) => LEVELS[level - 1]?.cost ?? NaN;
const gold = (game: Game, playerId = 0) =>
  game.getState().players[playerId]?.gold ?? NaN;

describe('tower upgrade and sell', () => {
  it('upgrades with the next level cost and emits GoldChanged then TowerUpgraded', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    place(game, 2, 0);
    game.drainEvents();
    expect(game.apply({ type: 'UpgradeTower', towerId: 1 }, 0)).toEqual({
      ok: true,
    });
    expect(game.drainEvents()).toEqual<GameEvent[]>([
      {
        type: 'GoldChanged',
        playerId: 0,
        gold: 150 - cost(1) - cost(2),
        delta: -cost(2),
        reason: 'upgrade',
      },
      { type: 'TowerUpgraded', playerId: 0, towerId: 1, level: 2 },
    ]);
    const tower = game.getState().lanes[0]?.towers[0];
    expect(tower?.level).toBe(2);
    expect(tower?.invested).toBe(cost(1) + cost(2));
    // 40 gold left, level 3 costs more.
    expect(game.apply({ type: 'UpgradeTower', towerId: 1 }, 0)).toEqual({
      ok: false,
      reason: 'NotEnoughGold',
    });
  });

  it('rejects unknown towers, foreign towers and max level', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    place(game, 2, 0);
    expect(game.apply({ type: 'UpgradeTower', towerId: 999 }, 0)).toEqual({
      ok: false,
      reason: 'TowerNotFound',
    });
    expect(game.apply({ type: 'SellTower', towerId: 999 }, 0)).toEqual({
      ok: false,
      reason: 'TowerNotFound',
    });
    expect(game.apply({ type: 'UpgradeTower', towerId: 1 }, 1)).toEqual({
      ok: false,
      reason: 'NotOwner',
    });
    expect(game.apply({ type: 'SellTower', towerId: 1 }, 1)).toEqual({
      ok: false,
      reason: 'NotOwner',
    });
    // Max level: a PvE game on the real serpentine map, where the long route leaves time to earn
    // the gold (income + bounties) for the last level.
    const pve = createGame(pveConfig(), 1);
    expect(place(pve, 5, 6).ok).toBe(true); // ground next to the x=4 road
    expect(pve.apply({ type: 'UpgradeTower', towerId: 1 }, 0).ok).toBe(true);
    let ticks = 0;
    while (gold(pve) < cost(3) && ticks < 5000) {
      stepN(pve, 1);
      ticks++;
    }
    expect(gold(pve)).toBeGreaterThanOrEqual(cost(3));
    expect(pve.apply({ type: 'UpgradeTower', towerId: 1 }, 0).ok).toBe(true);
    expect(pve.getState().lanes[0]?.towers[0]?.level).toBe(LEVELS.length);
    expect(pve.apply({ type: 'UpgradeTower', towerId: 1 }, 0)).toEqual({
      ok: false,
      reason: 'MaxLevel',
    });
  });

  it('sells for floor(invested * ratio), emits TowerSold then GoldChanged, recomputes the flow field', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    const initialField = game.getState().lanes[0]?.flowField;
    place(game, 3, 1);
    game.apply({ type: 'UpgradeTower', towerId: 1 }, 0);
    const invested = cost(1) + cost(2);
    const refund = Math.floor(invested * ECONOMY.sellRefundRatio);
    const goldBefore = gold(game);
    game.drainEvents();
    expect(game.apply({ type: 'SellTower', towerId: 1 }, 0)).toEqual({
      ok: true,
    });
    expect(game.drainEvents()).toEqual<GameEvent[]>([
      { type: 'TowerSold', playerId: 0, towerId: 1, refund },
      {
        type: 'GoldChanged',
        playerId: 0,
        gold: goldBefore + refund,
        delta: refund,
        reason: 'sell',
      },
    ]);
    const lane = game.getState().lanes[0];
    expect(lane?.towers).toHaveLength(0);
    for (const c of footprintCells({ x: 3, y: 1 })) {
      expect(
        lane?.flowField.dist[cellIndex(OPEN_MAP, c.x, c.y)],
      ).toBeGreaterThanOrEqual(0);
    }
    expect(lane?.flowField).toEqual(initialField);
    expect(game.apply({ type: 'SellTower', towerId: 1 }, 0)).toEqual({
      ok: false,
      reason: 'TowerNotFound',
    });
  });

  it('new towers start ready without target; towers acquire, keep and drop targets', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    place(game, 2, 0);
    const fresh = game.getState().lanes[0]?.towers[0];
    expect(fresh).toMatchObject({ level: 1, cooldown: 0, targetId: null });

    sendToLane0(game, 1);
    const events = stepN(game, 1);
    const creepId = game.getState().lanes[0]?.creeps[0]?.id;
    // Fired on the spawn tick: cooldown restarts at cooldownTicks.
    expect(events.some((e) => e.type === 'ProjectileFired')).toBe(true);
    expect(game.getState().lanes[0]?.towers[0]).toMatchObject({
      cooldown: LEVELS[0]?.cooldownTicks,
      targetId: creepId,
    });
    stepN(game, 1);
    expect(game.getState().lanes[0]?.towers[0]?.cooldown).toBe(
      (LEVELS[0]?.cooldownTicks ?? 0) - 1,
    );

    // Upgrading keeps the current cooldown and target.
    game.apply({ type: 'UpgradeTower', towerId: 1 }, 0);
    expect(game.getState().lanes[0]?.towers[0]).toMatchObject({
      level: 2,
      targetId: creepId,
    });

    // Once the creep is gone (killed or out of range) the target is dropped.
    stepN(game, 200);
    expect(game.getState().lanes[0]?.creeps).toHaveLength(0);
    expect(game.getState().lanes[0]?.towers[0]?.targetId).toBeNull();
  });
});

describe('projectiles', () => {
  it('home onto the target and hit after the expected number of ticks', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    place(game, 2, 0); // center (3, 1)
    sendToLane0(game, 1);
    const first = stepN(game, 1);
    const fired = first.find((e) => e.type === 'ProjectileFired');
    expect(fired?.type === 'ProjectileFired' && fired.projectile.pos).toEqual({
      x: 3,
      y: 1,
    });

    // Reference kinematics: each tick the projectile moves 0.6 toward the creep's current
    // position (phase 3), then the creep moves 0.1 along +x (phase 4).
    const speed = LEVELS[0]?.projectileSpeed ?? 0;
    let px = 3;
    let py = 1;
    let cx = 0.5;
    const cy = 2.5;
    let expectedTick = -1;
    for (let t = 0; t < 100 && expectedTick < 0; t++) {
      const dx = cx - px;
      const dy = cy - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= speed) expectedTick = t;
      else {
        px += (dx / d) * speed;
        py += (dy / d) * speed;
      }
      cx += 0.1;
    }
    expect(expectedTick).toBe(4);

    let hitTick = first.some((e) => e.type === 'CreepHit') ? 0 : -1;
    for (let t = 1; t < 20 && hitTick < 0; t++) {
      if (stepN(game, 1).some((e) => e.type === 'CreepHit')) hitTick = t;
    }
    expect(hitTick).toBe(expectedTick);
  });

  it('emit CreepHit with decreasing hp, then GoldChanged(kill) and CreepKilled', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    place(game, 2, 0);
    place(game, 6, 0);
    sendToLane0(game, 1);
    const events = stepN(game, 200);
    const creepEvents = events.filter(
      (e) =>
        e.type === 'CreepHit' ||
        e.type === 'CreepKilled' ||
        (e.type === 'GoldChanged' && e.reason === 'kill'),
    );
    const hits = creepEvents.filter((e) => e.type === 'CreepHit');
    const damage = LEVELS[0]?.damage ?? 0;
    expect(hits.length).toBe(Math.ceil(CREEPS.beetle.hp / damage));
    hits.forEach((h, i) =>
      expect(h.type === 'CreepHit' && h.hpAfter).toBe(
        CREEPS.beetle.hp - damage * (i + 1),
      ),
    );
    expect(creepEvents.slice(-2).map((e) => e.type)).toEqual([
      'GoldChanged',
      'CreepKilled',
    ]);
    expect(creepEvents.at(-1)).toMatchObject({
      type: 'CreepKilled',
      playerId: 0,
      bounty: 5,
    });
    expect(game.getState().lanes[0]?.creeps).toHaveLength(0);
  });

  it('are removed silently when their target dies first', () => {
    const game = createGame(pveConfig(LONG_MAP), 1);
    place(game, 2, 0);
    place(game, 4, 3);
    place(game, 7, 0);
    game.apply({ type: 'StartWave' }, 0);
    game.drainEvents();
    let silentRemovals = 0;
    const killed = new Set<number>();
    for (let t = 0; t < 400; t++) {
      const before = game.getState().lanes[0]?.projectiles ?? [];
      game.step();
      const events = game.drainEvents();
      const after = game.getState().lanes[0];
      const dead = new Set(
        events.flatMap((e) =>
          e.type === 'CreepKilled' || e.type === 'LifeLost' ? [e.creepId] : [],
        ),
      );
      const hitBy = new Set(
        events.flatMap((e) => (e.type === 'CreepHit' ? [e.projectileId] : [])),
      );
      for (const p of after?.projectiles ?? [])
        expect(dead.has(p.targetId)).toBe(false);
      for (const p of before) {
        if (dead.has(p.targetId) && !hitBy.has(p.id)) silentRemovals++;
      }
      // No hit is ever reported on a creep after its death.
      for (const e of events) {
        if (e.type === 'CreepHit') expect(killed.has(e.creepId)).toBe(false);
      }
      for (const id of dead) killed.add(id);
    }
    expect(silentRemovals).toBeGreaterThan(0);
  });
});

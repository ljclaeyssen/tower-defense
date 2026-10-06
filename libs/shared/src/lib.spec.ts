import {
  CREEPS,
  TOWER_TYPE_IDS,
  ECONOMY,
  FACTIONS,
  FACTION_IDS,
  MAPS,
  TOWERS,
  TOWER_ROLES,
  TARGET_FILTERS,
  TARGET_ORDERS,
  DEFAULT_TARGETING,
  WAVES,
  getFactionTowers,
  getTowerLevel,
  isCreepTypeId,
  isFactionId,
  type MapDef,
} from './index.js';

describe('shared data integrity', () => {
  it('every wave references a known creep type', () => {
    for (const wave of WAVES) {
      expect(isCreepTypeId(wave.creepType)).toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.spawnIntervalTicks).toBeGreaterThan(0);
    }
  });

  it('towers have 3 levels with positive stats, a matching attack kind and visual keys', () => {
    for (const id of TOWER_TYPE_IDS) {
      const tower = TOWERS[id];
      expect(tower.id).toBe(id);
      expect(isFactionId(tower.faction)).toBe(true);
      expect(TOWER_ROLES).toContain(tower.role);
      expect(tower.nameKey).toBe(`towers.${tower.id}.name`);
      expect(tower.descKey).toBe(`towers.${tower.id}.desc`);
      expect(tower.levels).toHaveLength(3);
      tower.levels.forEach((level, i) => {
        expect(level.cost).toBeGreaterThan(0);
        expect(level.damage).toBeGreaterThan(0);
        expect(level.range).toBeGreaterThan(0);
        expect(level.cooldownTicks).toBeGreaterThan(0);
        expect(level.attack.kind).toBe(tower.role);
        expect(level.projectile.speed).toBeGreaterThan(0);
        expect(level.projectile.visual.length).toBeGreaterThan(0);
        expect(level.model).toBe(`${tower.id}-${i + 1}`);
        switch (level.attack.kind) {
          case 'pierce':
            expect(level.attack.behindCells).toBeGreaterThan(0);
            expect(level.attack.behindRatio).toBeGreaterThan(0);
            break;
          case 'slow':
            expect(level.attack.factor).toBeGreaterThan(0);
            expect(level.attack.factor).toBeLessThan(1);
            expect(level.attack.durationTicks).toBeGreaterThan(0);
            break;
          case 'burst':
            expect(level.attack.splashRadius).toBeGreaterThan(0);
            expect(level.attack.splashRatio).toBeGreaterThan(0);
            break;
          case 'single':
            break;
        }
      });
      expect(getTowerLevel(id, 3)).toBe(tower.levels[2]);
      expect(() => getTowerLevel(id, 4)).toThrow();
    }
  });

  it('targeting uses known orders and filters; slow towers skip already slowed creeps', () => {
    expect(DEFAULT_TARGETING).toEqual({ order: 'first' });
    for (const id of TOWER_TYPE_IDS) {
      const tower = TOWERS[id];
      for (const level of tower.levels) {
        const targeting = level.targeting ?? DEFAULT_TARGETING;
        expect(TARGET_ORDERS).toContain(targeting.order);
        for (const filter of targeting.filters ?? []) {
          expect(TARGET_FILTERS).toContain(filter);
        }
        if (targeting.sticky !== undefined)
          expect(typeof targeting.sticky).toBe('boolean');
        if (tower.role === 'slow') {
          expect(targeting.order).toBe('first');
          expect(targeting.filters).toContain('unslowed');
        }
      }
    }
  });

  it('every faction has exactly one tower per role, in role order', () => {
    expect(FACTION_IDS.length).toBeGreaterThan(0);
    for (const factionId of FACTION_IDS) {
      const faction = FACTIONS[factionId];
      expect(faction.id).toBe(factionId);
      expect(faction.color).toMatch(/^#[0-9a-f]{6}$/i);
      const towers = getFactionTowers(factionId);
      expect(towers).toHaveLength(TOWER_ROLES.length);
      expect(towers).toEqual(faction.towers);
      towers.forEach((id, i) => {
        expect(TOWERS[id].faction).toBe(factionId);
        expect(TOWERS[id].role).toBe(TOWER_ROLES[i]);
      });
    }
    // Every tower belongs to the faction that lists it.
    for (const tower of Object.values(TOWERS)) {
      if (!isFactionId(tower.faction)) throw new Error(tower.faction);
      expect(FACTIONS[tower.faction].towers).toContain(tower.id);
    }
  });

  it('maps keep spawn, exit, waypoints and rocks inside the grid', () => {
    for (const map of Object.values(MAPS) as MapDef[]) {
      for (const p of [
        map.spawn,
        map.exit,
        ...map.path,
        ...(map.rocks ?? []),
      ]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(map.width);
        expect(p.y).toBeLessThan(map.height);
      }
    }
  });

  it('map roads are axis-aligned polylines from the spawn to the exit', () => {
    for (const map of Object.values(MAPS) as MapDef[]) {
      expect(map.path.length).toBeGreaterThanOrEqual(2);
      expect(map.path[0]).toEqual(map.spawn);
      expect(map.path.at(-1)).toEqual(map.exit);
      for (let i = 1; i < map.path.length; i++) {
        const a = map.path[i - 1];
        const b = map.path[i];
        expect(a?.x === b?.x || a?.y === b?.y).toBe(true);
      }
      expect(map.pathWidth ?? 1).toBeGreaterThanOrEqual(1);
    }
  });

  it('economy and creeps are sane', () => {
    expect(ECONOMY.sellRefundRatio).toBeGreaterThan(0);
    expect(ECONOMY.sellRefundRatio).toBeLessThanOrEqual(1);
    for (const creep of Object.values(CREEPS)) {
      expect(creep.hp).toBeGreaterThan(0);
      expect(creep.speed).toBeGreaterThan(0);
    }
  });
});

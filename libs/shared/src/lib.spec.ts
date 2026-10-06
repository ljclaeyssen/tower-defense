import {
  CREEPS,
  ECONOMY,
  MAPS,
  TOWERS,
  WAVES,
  isCreepTypeId,
  isTowerTypeId,
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

  it('towers have 3 increasing levels with positive stats', () => {
    for (const tower of Object.values(TOWERS)) {
      expect(isTowerTypeId(tower.id)).toBe(true);
      expect(tower.levels).toHaveLength(3);
      for (const level of tower.levels) {
        expect(level.cost).toBeGreaterThan(0);
        expect(level.damage).toBeGreaterThan(0);
        expect(level.range).toBeGreaterThan(0);
        expect(level.cooldownTicks).toBeGreaterThan(0);
        expect(level.projectileSpeed).toBeGreaterThan(0);
      }
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

import {
  CREEPS,
  ECONOMY,
  MAPS,
  TOWERS,
  WAVES,
  isCreepTypeId,
  isTowerTypeId,
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

  it('maps keep spawn and exit inside the grid', () => {
    for (const map of Object.values(MAPS)) {
      for (const p of [map.spawn, map.exit, ...map.blocked]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(map.width);
        expect(p.y).toBeLessThan(map.height);
      }
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

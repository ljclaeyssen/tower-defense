import type { TowerLevelDef } from '@td/shared';
import { attackStat, keyStat } from './tower-stats';

const level = (attack: TowerLevelDef['attack']): TowerLevelDef => ({
  cost: 50,
  damage: 14,
  range: 4,
  cooldownTicks: 12,
  attack,
  projectile: { visual: 'arrow', speed: 0.6, homing: true },
  model: 'm',
});

describe('tower stats', () => {
  it('uses damage as the key stat of single-target towers', () => {
    expect(attackStat({ kind: 'single' })).toBeNull();
    expect(keyStat(level({ kind: 'single' }))).toEqual({
      key: 'hud.damageStat',
      params: { damage: 14 },
    });
  });

  it('describes pierce, slow and burst attacks', () => {
    expect(
      attackStat({ kind: 'pierce', behindCells: 2, behindRatio: 0.5 }),
    ).toEqual({
      key: 'hud.behind',
      params: { cells: 2, percent: 50 },
    });
    expect(
      attackStat({ kind: 'slow', factor: 0.6, durationTicks: 30 }),
    ).toEqual({
      key: 'hud.slowStat',
      params: { percent: 40, seconds: 1.5 },
    });
    expect(
      attackStat({ kind: 'burst', splashRadius: 1.5, splashRatio: 0.35 }),
    ).toEqual({
      key: 'hud.splash',
      params: { radius: 1.5, percent: 35 },
    });
  });
});

import {
  secondsFromTicks,
  type AttackDef,
  type TowerLevelDef,
} from '@td/shared';

/** A translatable sentence: i18n key plus its interpolation params. */
export interface StatText {
  readonly key: string;
  readonly params: Readonly<Record<string, number>>;
}

const percent = (ratio: number): number => Math.round(ratio * 100);
const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

/** The role-specific line of an attack (pierce / slow / burst), or null for plain single-target hits. */
export function attackStat(attack: AttackDef): StatText | null {
  switch (attack.kind) {
    case 'single':
      return null;
    case 'pierce':
      return {
        key: 'hud.behind',
        params: {
          cells: attack.behindCells,
          percent: percent(attack.behindRatio),
        },
      };
    case 'slow':
      return {
        key: 'hud.slowStat',
        params: {
          percent: percent(1 - attack.factor),
          seconds: oneDecimal(secondsFromTicks(attack.durationTicks)),
        },
      };
    case 'burst':
      return {
        key: 'hud.splash',
        params: {
          radius: attack.splashRadius,
          percent: percent(attack.splashRatio),
        },
      };
  }
}

/** The one stat that best sums up a level: its role line, or its damage for single-target towers. */
export function keyStat(level: TowerLevelDef): StatText {
  return (
    attackStat(level.attack) ?? {
      key: 'hud.damageStat',
      params: { damage: level.damage },
    }
  );
}

import type { GridPos } from '../types.js';

export interface TowerLevelDef {
  /** Gold to reach this level (level 1 = build cost). */
  readonly cost: number;
  readonly damage: number;
  /** Range in cells, measured from the footprint center to the creep center. */
  readonly range: number;
  readonly cooldownTicks: number;
  /** Cells per tick. */
  readonly projectileSpeed: number;
}

export interface TowerDef {
  readonly id: string;
  /** i18n key, e.g. "towers.archer.name". */
  readonly nameKey: string;
  readonly levels: readonly TowerLevelDef[];
}

export interface CreepDef {
  readonly id: string;
  readonly nameKey: string;
  readonly hp: number;
  /** Cells per tick. */
  readonly speed: number;
  readonly bounty: number;
  /** Additional HP fraction per wave index: maxHp = hp * (1 + hpGrowthPerWave * waveIndex). */
  readonly hpGrowthPerWave: number;
  /** PvP only: gold cost to send one, and permanent income bonus per creep sent. */
  readonly sendCost: number;
  readonly incomeBonus: number;
}

export interface WaveDef {
  readonly creepType: string;
  readonly count: number;
  readonly spawnIntervalTicks: number;
  /** Optional extra multiplier on top of `hpGrowthPerWave`. */
  readonly hpMultiplier?: number;
}

export interface MapDef {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly spawn: GridPos;
  readonly exit: GridPos;
  /** Permanently solid cells (unbuildable, unwalkable). */
  readonly blocked: readonly GridPos[];
}

export interface EconomyDef {
  readonly startingGold: number;
  readonly startingLives: number;
  readonly baseIncome: number;
  readonly incomePeriodTicks: number;
  /** Fraction of `invested` gold returned when selling. */
  readonly sellRefundRatio: number;
  /** Build time before the first wave. */
  readonly firstWaveDelayTicks: number;
  /** Delay between the last spawn of a wave and the automatic start of the next. */
  readonly waveCountdownTicks: number;
}

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
  /**
   * The road, as ordered waypoints of an axis-aligned polyline (consecutive waypoints share x or y).
   * The sim expands it to cells. First waypoint = `spawn`, last waypoint = `exit`.
   */
  readonly path: readonly GridPos[];
  /** Road width in cells (default 1); extra cells are added on the right/bottom side of each segment. */
  readonly pathWidth?: number;
  /** Decorative solid cells (neither walkable nor buildable). Must not lie on the road. */
  readonly rocks?: readonly GridPos[];
  /**
   * Default false: creeps only walk on the road. When true, ground cells are walkable too (open-field
   * mazing, e.g. for later PvP maps); towers on ground then reshape the route and the anti-block
   * rules (`BlocksPath`, `OverlapsCreep`) matter again.
   */
  readonly groundWalkable?: boolean;
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

import type { GridPos } from '../types.js';

/**
 * Tower roles. Every faction ships exactly one tower per role, in this order (it drives the build
 * panel and the hotkeys 1-4). Adding a role = extend this union, add one `AttackDef` variant and one
 * impact case in the sim; everything else is data.
 */
export type TowerRole = 'single' | 'pierce' | 'slow' | 'burst';
export const TOWER_ROLES: readonly TowerRole[] = [
  'single',
  'pierce',
  'slow',
  'burst',
];

/** What happens when a projectile reaches its target. Fully specified per level, so levels can evolve it. */
export type AttackDef =
  /** Damages the target only. */
  | { readonly kind: 'single' }
  /**
   * Damages the target, then every creep of the same lane walking up to `behindCells` cells behind
   * it on the road (`distanceToExit` in ]target, target + behindCells]) for `damage * behindRatio`.
   */
  | {
      readonly kind: 'pierce';
      readonly behindCells: number;
      readonly behindRatio: number;
    }
  /** Damages the target and multiplies its speed by `factor` for `durationTicks` (strongest factor wins, duration refreshed). */
  | {
      readonly kind: 'slow';
      readonly factor: number;
      readonly durationTicks: number;
    }
  /** Damages the target, then every creep within `splashRadius` cells of it for `damage * splashRatio`. */
  | {
      readonly kind: 'burst';
      readonly splashRadius: number;
      readonly splashRatio: number;
    };

export type AttackKind = AttackDef['kind'];

export interface ProjectileDef {
  /** Key of the projectile visual in the renderer registry (and of the atlas frame later), e.g. "arrow-human". */
  readonly visual: string;
  /** Cells per tick. */
  readonly speed: number;
  /** Homing projectiles follow their target; non-homing ones fly to the aimed position (not implemented yet, reserved). */
  readonly homing: boolean;
}

export interface TowerLevelDef {
  /** Gold to reach this level (level 1 = build cost). */
  readonly cost: number;
  readonly damage: number;
  /** Range in cells, measured from the footprint center to the creep center. */
  readonly range: number;
  readonly cooldownTicks: number;
  /** Attack behaviour at this level; `kind` must equal the tower `role`. */
  readonly attack: AttackDef;
  readonly projectile: ProjectileDef;
  /** Key of the tower model in the renderer registry (and of the atlas frame later), e.g. "human-archer-2". */
  readonly model: string;
}

export interface TowerDef {
  readonly id: string;
  /** Faction id (key of `factions.json`). */
  readonly faction: string;
  readonly role: TowerRole;
  /** i18n keys, e.g. "towers.human-archer.name" / ".desc". */
  readonly nameKey: string;
  readonly descKey: string;
  readonly levels: readonly TowerLevelDef[];
}

export interface FactionDef {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
  /** Accent colour (CSS hex) used by the UI and the placeholder renderer palettes. */
  readonly color: string;
  /** Tower ids, one per role, in `TOWER_ROLES` order. */
  readonly towers: readonly string[];
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

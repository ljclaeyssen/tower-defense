import type {
  CellKind,
  EntityId,
  GamePhase,
  GameResult,
  GridPos,
  PlayerId,
  Team,
  Vec2,
} from '../types.js';
import type { CreepTypeId, FactionId, TowerTypeId } from '../data/index.js';
import type { AttackKind } from '../data/schema.js';

export interface TowerState {
  readonly id: EntityId;
  readonly playerId: PlayerId;
  readonly type: TowerTypeId;
  /** 1-based level. */
  readonly level: number;
  /** Top-left cell of the 2x2 footprint. Render anchor = (pos.x + 1, pos.y + 1) in cell units. */
  readonly pos: GridPos;
  /** Ticks until the tower may fire again (0 = ready). */
  readonly cooldown: number;
  /** Gold spent so far (base cost + upgrades); the sell refund is derived from it. */
  readonly invested: number;
  /** Current target, if any. */
  readonly targetId: EntityId | null;
}

export interface CreepState {
  readonly id: EntityId;
  /** Owner of the lane the creep walks in (the defender). */
  readonly playerId: PlayerId;
  readonly type: CreepTypeId;
  /** Continuous position in cell units (center of the creep). */
  readonly pos: Vec2;
  readonly hp: number;
  readonly maxHp: number;
  /** Base speed in cells per tick (before slows). */
  readonly speed: number;
  /** Current speed multiplier from slow effects (1 = none). Effective speed = speed * slowFactor. */
  readonly slowFactor: number;
  /** Ticks before the slow expires (0 when none). */
  readonly slowTicks: number;
  /** Remaining path length to the exit in cells (for "first" targeting and HUD). */
  readonly distanceToExit: number;
  /** Unit vector of the current movement (for rendering the facing direction). */
  readonly dir: Vec2;
  readonly waveIndex: number;
  readonly bounty: number;
}

export interface ProjectileState {
  readonly id: EntityId;
  readonly playerId: PlayerId;
  readonly sourceTowerId: EntityId;
  readonly targetId: EntityId;
  readonly pos: Vec2;
  /** Cells per tick. */
  readonly speed: number;
  readonly damage: number;
  /** Attack behaviour applied on impact (see `AttackDef`). */
  readonly kind: AttackKind;
  /** Renderer registry key of the projectile visual. */
  readonly visual: string;
}

export interface FlowFieldState {
  /** Steps to the exit per cell (row-major, index = y * width + x); -1 = unreachable or solid. */
  readonly dist: readonly number[];
  /** Index of the next cell toward the exit per cell; -1 for the exit itself, solids and unreachable cells. */
  readonly next: readonly number[];
}

export interface LaneState {
  readonly playerId: PlayerId;
  readonly width: number;
  readonly height: number;
  readonly spawn: GridPos;
  readonly exit: GridPos;
  /** Row-major cell kinds (index = y * width + x): ground is buildable, path is the road, rock is decoration. */
  readonly cells: readonly CellKind[];
  /** True when creeps may also walk on ground cells (open-field mazing maps); see `MapDef.groundWalkable`. */
  readonly groundWalkable: boolean;
  readonly towers: readonly TowerState[];
  readonly creeps: readonly CreepState[];
  readonly projectiles: readonly ProjectileState[];
  readonly flowField: FlowFieldState;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly team: Team;
  readonly faction: FactionId;
  readonly gold: number;
  readonly lives: number;
  /** Gold granted every `economy.incomePeriodTicks`. */
  readonly income: number;
  readonly alive: boolean;
}

export interface WaveState {
  /** 0-based index of the current (or last started) wave; -1 before the first wave. */
  readonly index: number;
  readonly total: number;
  /** Tick at which the next wave starts automatically; null when no wave is pending. */
  readonly nextWaveTick: number | null;
  /** Creeps still to spawn in the current wave (summed over lanes). */
  readonly remainingToSpawn: number;
}

export interface GameState {
  readonly tick: number;
  readonly phase: GamePhase;
  readonly seed: number;
  readonly wave: WaveState;
  readonly players: readonly PlayerState[];
  readonly lanes: readonly LaneState[];
  readonly result: GameResult | null;
  /** PvP: winner; PvE: the single player on victory. */
  readonly winnerId: PlayerId | null;
}

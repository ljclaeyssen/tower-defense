import {
  CREEPS,
  FACTIONS,
  TOWERS,
  type AttackDef,
  type AttackKind,
  type CellKind,
  type FactionId,
  type CreepTypeId,
  type EntityId,
  type FlowFieldState,
  type GameConfig,
  type GameEvent,
  type GamePhase,
  type GameResult,
  type GridPos,
  type PlayerId,
  type Team,
  type TowerTypeId,
} from '@td/shared';
import { buildSolidMask } from './grid.js';
import { computeFlowField } from './flowfield.js';
import type { Rng } from './prng.js';

/*
 * Internal mutable model of the simulation. Only the sim mutates it; consumers only ever see the
 * immutable snapshots built in snapshot.ts. All collections are arrays iterated in insertion order.
 */

export interface SimTower {
  readonly id: EntityId;
  readonly playerId: PlayerId;
  readonly type: TowerTypeId;
  level: number;
  readonly pos: GridPos;
  cooldown: number;
  invested: number;
  targetId: EntityId | null;
}

export interface SimCreep {
  readonly id: EntityId;
  readonly playerId: PlayerId;
  readonly type: CreepTypeId;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  /** Base speed in cells per tick; the effective speed is `speed * slowFactor`. */
  readonly speed: number;
  /** Speed multiplier of the active slow (1 = none). */
  slowFactor: number;
  /** Ticks left on the active slow (0 = none). */
  slowTicks: number;
  dirX: number;
  dirY: number;
  /** Cell index the creep stands in (the last cell center it reached, or the spawn cell). */
  cell: number;
  /** Cell index whose center the creep is walking to; -1 when it has nowhere to go. */
  target: number;
  distanceToExit: number;
  readonly waveIndex: number;
  readonly bounty: number;
}

export interface SimProjectile {
  readonly id: EntityId;
  readonly playerId: PlayerId;
  readonly sourceTowerId: EntityId;
  readonly targetId: EntityId;
  x: number;
  y: number;
  readonly speed: number;
  readonly damage: number;
  /** Impact behaviour, copied from the tower level at fire time. */
  readonly attack: AttackDef;
  readonly kind: AttackKind;
  /** Renderer key of the projectile visual. */
  readonly visual: string;
}

export interface SpawnEntry {
  readonly creepType: CreepTypeId;
  readonly waveIndex: number;
  readonly hpMultiplier: number;
  readonly dueTick: number;
  /** True for wave creeps (counted in `wave.remainingToSpawn`), false for PvP sent creeps. */
  readonly fromWave: boolean;
}

export interface SimLane {
  readonly playerId: PlayerId;
  readonly width: number;
  readonly height: number;
  readonly spawn: GridPos;
  readonly exit: GridPos;
  readonly cells: readonly CellKind[];
  readonly groundWalkable: boolean;
  towers: SimTower[];
  creeps: SimCreep[];
  projectiles: SimProjectile[];
  /** Replaced (never mutated in place) on every recompute, so snapshots may share it. */
  flowField: FlowFieldState;
  queue: SpawnEntry[];
  /** PvP: set once the lane of a dead player has been emptied. */
  cleared: boolean;
}

export interface SimPlayer {
  readonly id: PlayerId;
  readonly team: Team;
  /** Decides which towers the player may build. */
  readonly faction: FactionId;
  gold: number;
  lives: number;
  income: number;
  alive: boolean;
}

export interface SimWave {
  index: number;
  readonly total: number;
  nextWaveTick: number | null;
  remainingToSpawn: number;
}

export interface World {
  readonly config: GameConfig;
  readonly seed: number;
  tick: number;
  phase: GamePhase;
  readonly wave: SimWave;
  readonly players: SimPlayer[];
  readonly lanes: SimLane[];
  result: GameResult | null;
  winnerId: PlayerId | null;
  /** Shared entity id counter (towers, creeps, projectiles), starts at 1. */
  nextId: number;
  readonly rng: Rng;
  events: GameEvent[];
}

export const allocId = (world: World): EntityId => world.nextId++;

export const emit = (world: World, event: GameEvent): void => {
  world.events.push(event);
};

/** Own-property lookups only (`'toString' in TOWERS` would be true). */
export const isKnownTowerType = (id: unknown): id is TowerTypeId =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(TOWERS, id);

export const isKnownCreepType = (id: unknown): id is CreepTypeId =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(CREEPS, id);

export const isKnownFaction = (id: unknown): id is FactionId =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(FACTIONS, id);

/** Recomputes the lane flow field (map blocks + tower footprints are solid). */
export function recomputeFlowField(lane: SimLane): void {
  const solid = buildSolidMask(lane);
  lane.flowField = computeFlowField(
    lane.width,
    lane.height,
    lane.exit,
    (x, y) => solid[y * lane.width + x] === true,
  );
}

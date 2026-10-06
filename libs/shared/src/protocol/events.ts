import type { EntityId, GameResult, PlayerId } from '../types.js';
import type { Command, RejectReason } from './commands.js';
import type { CreepState, ProjectileState, TowerState } from './state.js';

export type GoldChangeReason =
  'kill' | 'income' | 'build' | 'upgrade' | 'sell' | 'send' | 'initial';

export type GameEvent =
  | { readonly type: 'TowerPlaced'; readonly tower: TowerState }
  | {
      readonly type: 'TowerUpgraded';
      readonly playerId: PlayerId;
      readonly towerId: EntityId;
      readonly level: number;
    }
  | {
      readonly type: 'TowerSold';
      readonly playerId: PlayerId;
      readonly towerId: EntityId;
      readonly refund: number;
    }
  | { readonly type: 'CreepSpawned'; readonly creep: CreepState }
  | { readonly type: 'ProjectileFired'; readonly projectile: ProjectileState }
  | {
      readonly type: 'CreepHit';
      readonly playerId: PlayerId;
      readonly creepId: EntityId;
      readonly projectileId: EntityId;
      readonly damage: number;
      readonly hpAfter: number;
      /** False for secondary victims of pierce/burst attacks (same projectileId as the primary hit). */
      readonly primary: boolean;
    }
  | {
      readonly type: 'CreepSlowed';
      readonly playerId: PlayerId;
      readonly creepId: EntityId;
      readonly factor: number;
      readonly ticks: number;
    }
  | {
      readonly type: 'CreepKilled';
      readonly playerId: PlayerId;
      readonly creepId: EntityId;
      readonly bounty: number;
    }
  | {
      readonly type: 'LifeLost';
      readonly playerId: PlayerId;
      readonly creepId: EntityId;
      readonly livesAfter: number;
    }
  | {
      readonly type: 'WaveStarted';
      readonly waveIndex: number;
      readonly creepCount: number;
    }
  | {
      readonly type: 'GoldChanged';
      readonly playerId: PlayerId;
      readonly gold: number;
      readonly delta: number;
      readonly reason: GoldChangeReason;
    }
  | {
      readonly type: 'CommandRejected';
      readonly playerId: PlayerId;
      readonly command: Command;
      readonly reason: RejectReason;
    }
  | {
      readonly type: 'GameOver';
      readonly result: GameResult;
      readonly winnerId: PlayerId | null;
    };

export type GameEventType = GameEvent['type'];

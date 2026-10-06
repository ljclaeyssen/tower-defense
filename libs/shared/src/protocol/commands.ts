import type { GridPos, EntityId } from '../types.js';
import type { TowerTypeId, CreepTypeId } from '../data/index.js';

/**
 * Commands are the only input of the simulation. `pos` of PlaceTower is the top-left cell of the
 * 2x2 footprint. Commands are always applied on behalf of a `PlayerId` (see `Game.apply`).
 */
export type Command =
  | {
      readonly type: 'PlaceTower';
      readonly towerType: TowerTypeId;
      readonly pos: GridPos;
    }
  | { readonly type: 'UpgradeTower'; readonly towerId: EntityId }
  | { readonly type: 'SellTower'; readonly towerId: EntityId }
  /** PvP: send creeps to the opponent's lane (costs gold, raises income). Rejected in PvE. */
  | {
      readonly type: 'SendCreeps';
      readonly creepType: CreepTypeId;
      readonly count: number;
    }
  /** PvE: start the next wave now instead of waiting for the countdown. */
  | { readonly type: 'StartWave' };

export type CommandType = Command['type'];

export type RejectReason =
  | 'GameNotRunning'
  | 'UnknownPlayer'
  | 'UnknownType'
  | 'WrongFaction'
  | 'OutOfBounds'
  | 'CellBlocked'
  | 'OverlapsTower'
  | 'OverlapsCreep'
  | 'BlocksPath'
  | 'NotEnoughGold'
  | 'TowerNotFound'
  | 'NotOwner'
  | 'MaxLevel'
  | 'InvalidCount'
  | 'NotAvailableInMode'
  | 'NoWaveToStart';

export type CommandResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: RejectReason };

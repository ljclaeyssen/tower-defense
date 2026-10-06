import type { GameMode, PlayerId, Team } from './types.js';
import type { MapDef } from './data/schema.js';
import type { MapId } from './data/index.js';

export interface PlayerConfig {
  readonly id: PlayerId;
  readonly team: Team;
}

export interface GameConfig {
  readonly mode: GameMode;
  /** One lane per player; `id` must equal the array index. */
  readonly players: readonly PlayerConfig[];
  readonly mapId: MapId;
  /** Test hook: use this map definition instead of the one registered under `mapId`. */
  readonly mapOverride?: MapDef;
}

export const DEFAULT_PVE_CONFIG: GameConfig = {
  mode: 'pve',
  players: [{ id: 0, team: 'blue' }],
  mapId: 'basic',
};

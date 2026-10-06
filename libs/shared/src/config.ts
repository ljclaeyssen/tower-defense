import type { GameMode, PlayerId, Team } from './types.js';
import type { MapDef } from './data/schema.js';
import type { FactionId, MapId } from './data/index.js';

export interface PlayerConfig {
  readonly id: PlayerId;
  /** PvP side (cosmetic colour), unrelated to the faction. */
  readonly team: Team;
  /** Decides which towers the player may build (see `factions.json`). */
  readonly faction: FactionId;
}

export interface GameConfig {
  readonly mode: GameMode;
  /** One lane per player; `id` must equal the array index. */
  readonly players: readonly PlayerConfig[];
  readonly mapId: MapId;
  /** Test hook: use this map definition instead of the one registered under `mapId`. */
  readonly mapOverride?: MapDef;
}

export const DEFAULT_FACTION: FactionId = 'humans';

export const DEFAULT_PVE_CONFIG: GameConfig = {
  mode: 'pve',
  players: [{ id: 0, team: 'blue', faction: DEFAULT_FACTION }],
  mapId: 'basic',
};

/** Solo config for a chosen faction. */
export const pveConfigFor = (faction: FactionId): GameConfig => ({
  ...DEFAULT_PVE_CONFIG,
  players: [{ id: 0, team: 'blue', faction }],
});

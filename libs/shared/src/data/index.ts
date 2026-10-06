import towersJson from './towers.json' with { type: 'json' };
import factionsJson from './factions.json' with { type: 'json' };
import creepsJson from './creeps.json' with { type: 'json' };
import wavesJson from './waves.json' with { type: 'json' };
import economyJson from './economy.json' with { type: 'json' };
import basicMap from './maps/basic.json' with { type: 'json' };
import type {
  CreepDef,
  EconomyDef,
  FactionDef,
  MapDef,
  TowerDef,
  TowerLevelDef,
  WaveDef,
} from './schema.js';

/**
 * Balance data. The JSON keys are the ids: adding a tower or a faction is a JSON edit (plus i18n
 * keys and, if the visual keys are new, registry entries in the renderer).
 * The order of `towers.json` keys is hashed by the sim (type index): append, never reorder.
 */
// JSON imports widen string literals (`role`, `attack.kind`), so `satisfies` cannot check these two:
// the ids stay typed from the JSON keys and the shared data spec validates the contents at test time.
export const TOWERS = towersJson as unknown as {
  readonly [K in keyof typeof towersJson]: TowerDef;
};
export const FACTIONS = factionsJson as unknown as {
  readonly [K in keyof typeof factionsJson]: FactionDef;
};
export const CREEPS = creepsJson satisfies Record<string, CreepDef>;
export const WAVES = wavesJson satisfies readonly WaveDef[];
export const ECONOMY = economyJson satisfies EconomyDef;
export const MAPS = { basic: basicMap } satisfies Record<string, MapDef>;

export type TowerTypeId = keyof typeof TOWERS;
export type FactionId = keyof typeof FACTIONS;
export type CreepTypeId = keyof typeof CREEPS;
export type MapId = keyof typeof MAPS;

export const TOWER_TYPE_IDS = Object.keys(TOWERS) as readonly TowerTypeId[];
export const FACTION_IDS = Object.keys(FACTIONS) as readonly FactionId[];
export const CREEP_TYPE_IDS = Object.keys(CREEPS) as readonly CreepTypeId[];

export const isTowerTypeId = (id: string): id is TowerTypeId => id in TOWERS;
export const isFactionId = (id: string): id is FactionId => id in FACTIONS;
export const isCreepTypeId = (id: string): id is CreepTypeId => id in CREEPS;

export const getTowerDef = (id: TowerTypeId): TowerDef => TOWERS[id];
export const getFactionDef = (id: FactionId): FactionDef => FACTIONS[id];
export const getCreepDef = (id: CreepTypeId): CreepDef => CREEPS[id];
export const getMapDef = (id: MapId): MapDef => MAPS[id];

/** Tower ids of a faction in role order (single, pierce, slow, burst); the data spec guarantees they exist. */
export const getFactionTowers = (faction: FactionId): readonly TowerTypeId[] =>
  FACTIONS[faction].towers.filter(isTowerTypeId);

/** Level definition for a 1-based level; throws on an unknown level so callers never read `undefined`. */
export function getTowerLevel(type: TowerTypeId, level: number): TowerLevelDef {
  const def = TOWERS[type].levels[level - 1];
  if (!def) throw new Error(`Tower ${type} has no level ${level}`);
  return def;
}

export const getMaxLevel = (type: TowerTypeId): number =>
  TOWERS[type].levels.length;

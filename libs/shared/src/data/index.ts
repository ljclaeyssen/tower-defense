import towersJson from './towers.json' with { type: 'json' };
import creepsJson from './creeps.json' with { type: 'json' };
import wavesJson from './waves.json' with { type: 'json' };
import economyJson from './economy.json' with { type: 'json' };
import basicMap from './maps/basic.json' with { type: 'json' };
import type {
  CreepDef,
  EconomyDef,
  MapDef,
  TowerDef,
  WaveDef,
} from './schema.js';

export const TOWERS = towersJson satisfies Record<string, TowerDef>;
export const CREEPS = creepsJson satisfies Record<string, CreepDef>;
export const WAVES = wavesJson satisfies readonly WaveDef[];
export const ECONOMY = economyJson satisfies EconomyDef;
export const MAPS = { basic: basicMap } satisfies Record<string, MapDef>;

export type TowerTypeId = keyof typeof TOWERS;
export type CreepTypeId = keyof typeof CREEPS;
export type MapId = keyof typeof MAPS;

export const TOWER_TYPE_IDS = Object.keys(TOWERS) as readonly TowerTypeId[];
export const CREEP_TYPE_IDS = Object.keys(CREEPS) as readonly CreepTypeId[];

export const isTowerTypeId = (id: string): id is TowerTypeId => id in TOWERS;
export const isCreepTypeId = (id: string): id is CreepTypeId => id in CREEPS;

export const getTowerDef = (id: TowerTypeId): TowerDef => TOWERS[id];
export const getCreepDef = (id: CreepTypeId): CreepDef => CREEPS[id];
export const getMapDef = (id: MapId): MapDef => MAPS[id];

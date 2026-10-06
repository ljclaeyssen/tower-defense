/**
 * Tower generators: one kit module per faction, each implementing the four roles with its own
 * architecture. Adding a faction = one kit module + one entry here (+ its colours in palette.ts);
 * adding a role = one generator per kit.
 */
import type { FactionId, TowerRole } from '@td/shared';
import type { Sprite, TowerParams } from '../types.js';
import { DWARF_TOWERS } from './kits/dwarves.js';
import { ELF_TOWERS } from './kits/elves.js';
import { HUMAN_TOWERS } from './kits/humans/index.js';
import { ORC_TOWERS } from './kits/orcs.js';
import type { FactionTowers } from './kits/types.js';
import { UNDEAD_TOWERS } from './kits/undead.js';

export type { FactionTowers } from './kits/types.js';

export const TOWER_KITS: Readonly<Record<FactionId, FactionTowers>> = {
  humans: HUMAN_TOWERS,
  elves: ELF_TOWERS,
  orcs: ORC_TOWERS,
  undead: UNDEAD_TOWERS,
  dwarves: DWARF_TOWERS,
};

export function generateTower(role: TowerRole, params: TowerParams): Sprite {
  return TOWER_KITS[params.faction][role](params);
}

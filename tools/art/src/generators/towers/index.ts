/**
 * Tower generators by role. Adding a role = one generator file + one entry here; adding a faction =
 * one kit in palette.ts.
 */
import type { TowerRole } from '@td/shared';
import type { Sprite, TowerGenerator, TowerParams } from '../types.js';
import { generateArcherTower } from './archer.js';
import { generateFrostTower } from './frost.js';
import { generateSiegeTower } from './siege.js';
import { generateStormTower } from './storm.js';

export const TOWER_GENERATORS: Readonly<Record<TowerRole, TowerGenerator>> = {
  single: generateArcherTower,
  pierce: generateStormTower,
  slow: generateFrostTower,
  burst: generateSiegeTower,
};

export function generateTower(role: TowerRole, params: TowerParams): Sprite {
  return TOWER_GENERATORS[role](params);
}

import type { TowerRole } from '@td/shared';
import type { TowerGenerator } from '../../types.js';

/** The four role generators of one faction. */
export type FactionTowers = Readonly<Record<TowerRole, TowerGenerator>>;

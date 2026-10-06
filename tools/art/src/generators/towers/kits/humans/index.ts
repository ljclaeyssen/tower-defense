/**
 * Humans: the stone-keep reference. Masonry towers, wooden platforms and balconies, slate cone
 * roofs, gold trims, swallowtail banners.
 */
import type { FactionTowers } from '../types.js';
import { generateArcherTower } from './archer.js';
import { generateFrostTower } from './frost.js';
import { generateSiegeTower } from './siege.js';
import { generateStormTower } from './storm.js';

export const HUMAN_TOWERS: FactionTowers = {
  single: generateArcherTower,
  pierce: generateStormTower,
  slow: generateFrostTower,
  burst: generateSiegeTower,
};

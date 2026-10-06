/**
 * Art pipeline: parametric TypeScript generators produce SVG, rasterised to PNG with @resvg/resvg-js
 * and packed into a Phaser atlas under apps/web/public/assets/. See CLAUDE.md "Art pipeline".
 */
export { buildManifest, filterManifest } from './manifest.js';
export type { FrameEntry, FrameGroup } from './manifest.js';
export { generateTower, TOWER_KITS } from './generators/towers/index.js';
export { generateGround, GROUND_KINDS } from './generators/ground.js';
export { generateProjectile } from './generators/projectiles.js';
export type { Sprite, TowerParams } from './generators/types.js';
export { KITS, TEAM_COLOURS } from './palette.js';

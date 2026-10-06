export type { Game } from './lib/api.js';
export { createGame } from './lib/game.js';
export { validatePlacement } from './lib/placement.js';
export {
  footprintCells,
  towerCenter,
  cellIndex,
  expandPath,
  buildCells,
} from './lib/grid.js';
export { computeFlowField } from './lib/flowfield.js';

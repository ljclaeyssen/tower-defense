/** Index of the player inside `GameConfig.players` (also the lane index). */
export type PlayerId = number;

export type Team = 'red' | 'blue';

/** Integer cell coordinates on the fine square grid. */
export interface GridPos {
  readonly x: number;
  readonly y: number;
}

/** Continuous position in cell units. Cell (i, j) spans [i, i+1) x [j, j+1); its center is (i+0.5, j+0.5). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Unique per game, monotonically increasing, shared by towers, creeps and projectiles. */
export type EntityId = number;

export type GameMode = 'pve' | 'pvp';

export type GamePhase = 'waiting' | 'running' | 'ended';

export type GameResult = 'victory' | 'defeat' | 'draw';

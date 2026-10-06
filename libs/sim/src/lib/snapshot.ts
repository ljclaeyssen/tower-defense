import type {
  CreepState,
  GameState,
  LaneState,
  ProjectileState,
  TowerState,
} from '@td/shared';
import type {
  SimCreep,
  SimLane,
  SimProjectile,
  SimTower,
  World,
} from './model.js';

/* Conversions from the internal mutable model to fresh plain-data objects. */

export const toTowerState = (t: SimTower): TowerState => ({
  id: t.id,
  playerId: t.playerId,
  type: t.type,
  level: t.level,
  pos: { x: t.pos.x, y: t.pos.y },
  cooldown: t.cooldown,
  invested: t.invested,
  targetId: t.targetId,
});

export const toCreepState = (c: SimCreep): CreepState => ({
  id: c.id,
  playerId: c.playerId,
  type: c.type,
  pos: { x: c.x, y: c.y },
  hp: c.hp,
  maxHp: c.maxHp,
  speed: c.speed,
  distanceToExit: c.distanceToExit,
  dir: { x: c.dirX, y: c.dirY },
  waveIndex: c.waveIndex,
  bounty: c.bounty,
});

export const toProjectileState = (p: SimProjectile): ProjectileState => ({
  id: p.id,
  playerId: p.playerId,
  sourceTowerId: p.sourceTowerId,
  targetId: p.targetId,
  pos: { x: p.x, y: p.y },
  speed: p.speed,
  damage: p.damage,
});

const toLaneState = (lane: SimLane): LaneState => ({
  playerId: lane.playerId,
  width: lane.width,
  height: lane.height,
  spawn: { x: lane.spawn.x, y: lane.spawn.y },
  exit: { x: lane.exit.x, y: lane.exit.y },
  // Never mutated in place by the sim (the flow field is replaced on recompute): safe to share.
  cells: lane.cells,
  groundWalkable: lane.groundWalkable,
  towers: lane.towers.map(toTowerState),
  creeps: lane.creeps.map(toCreepState),
  projectiles: lane.projectiles.map(toProjectileState),
  flowField: lane.flowField,
});

/** Builds an immutable plain-data snapshot of the world (fresh objects, nothing aliased that the sim mutates). */
export function buildSnapshot(world: World): GameState {
  return {
    tick: world.tick,
    phase: world.phase,
    seed: world.seed,
    wave: {
      index: world.wave.index,
      total: world.wave.total,
      nextWaveTick: world.wave.nextWaveTick,
      remainingToSpawn: world.wave.remainingToSpawn,
    },
    players: world.players.map((p) => ({
      id: p.id,
      team: p.team,
      gold: p.gold,
      lives: p.lives,
      income: p.income,
      alive: p.alive,
    })),
    lanes: world.lanes.map(toLaneState),
    result: world.result,
    winnerId: world.winnerId,
  };
}

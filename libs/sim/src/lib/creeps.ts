import { getCreepDef } from '@td/shared';
import { cellCenterX, cellCenterY, cellIndex } from './grid.js';
import {
  allocId,
  emit,
  type SimCreep,
  type SimLane,
  type SpawnEntry,
  type World,
} from './model.js';
import { dropOrphanProjectiles } from './projectiles.js';
import { toCreepState } from './snapshot.js';

/**
 * Tolerance when comparing the remaining distance to the movement budget, so accumulated float
 * error (e.g. ten steps of 0.1 summing to 0.9999999999999999) never costs a creep a whole tick.
 */
const ARRIVAL_EPSILON = 1e-9;

/** Points `dir` at the target cell center (unchanged when there is no target or it is reached). */
function aim(lane: SimLane, creep: SimCreep): void {
  if (creep.target < 0) return;
  const dx = cellCenterX(lane, creep.target) - creep.x;
  const dy = cellCenterY(lane, creep.target) - creep.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0) {
    creep.dirX = dx / d;
    creep.dirY = dy / d;
  }
}

/** distanceToExit = dist[target] + euclid(pos, target center); 0 when the creep has no target. */
export function refreshDistance(lane: SimLane, creep: SimCreep): void {
  if (creep.target < 0) {
    creep.distanceToExit = 0;
    return;
  }
  const dx = cellCenterX(lane, creep.target) - creep.x;
  const dy = cellCenterY(lane, creep.target) - creep.y;
  creep.distanceToExit =
    (lane.flowField.dist[creep.target] ?? 0) + Math.sqrt(dx * dx + dy * dy);
}

/** After a flow field recompute: targets are kept (they change at the next cell center), distances refresh. */
export function refreshCreepDistances(lane: SimLane): void {
  for (const creep of lane.creeps) refreshDistance(lane, creep);
}

/** Cells (current + target) of every living creep of the lane, internal model. */
export function laneCreepCells(lane: SimLane): number[] {
  const cells: number[] = [];
  for (const c of lane.creeps) {
    cells.push(c.cell);
    if (c.target >= 0) cells.push(c.target);
  }
  return cells;
}

export function spawnCreep(
  world: World,
  lane: SimLane,
  entry: SpawnEntry,
): void {
  const def = getCreepDef(entry.creepType);
  const spawnIndex = cellIndex(lane, lane.spawn.x, lane.spawn.y);
  const maxHp = Math.round(
    def.hp * (1 + def.hpGrowthPerWave * entry.waveIndex) * entry.hpMultiplier,
  );
  const creep: SimCreep = {
    id: allocId(world),
    playerId: lane.playerId,
    type: entry.creepType,
    x: lane.spawn.x + 0.5,
    y: lane.spawn.y + 0.5,
    hp: maxHp,
    maxHp,
    speed: def.speed,
    dirX: 0,
    dirY: 0,
    cell: spawnIndex,
    target: lane.flowField.next[spawnIndex] ?? -1,
    distanceToExit: 0,
    waveIndex: entry.waveIndex,
    bounty: def.bounty,
  };
  aim(lane, creep);
  refreshDistance(lane, creep);
  lane.creeps.push(creep);
  emit(world, { type: 'CreepSpawned', creep: toCreepState(creep) });
}

/**
 * Moves one creep by `speed` cells along the flow field. Returns true when it reached the exit.
 * The creep walks to the center of `target`; on arrival it snaps there, re-reads `next` (so a
 * recomputed flow field takes effect at cell centers only) and spends the leftover movement
 * toward the following cell.
 */
function moveCreep(lane: SimLane, creep: SimCreep, exitIndex: number): boolean {
  if (creep.cell === exitIndex) return true;
  let move = creep.speed;
  while (move > 0 && creep.target >= 0) {
    const tx = cellCenterX(lane, creep.target);
    const ty = cellCenterY(lane, creep.target);
    const dx = tx - creep.x;
    const dy = ty - creep.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= move + ARRIVAL_EPSILON) {
      creep.x = tx;
      creep.y = ty;
      move -= d;
      creep.cell = creep.target;
      if (creep.cell === exitIndex) return true;
      creep.target = lane.flowField.next[creep.cell] ?? -1;
    } else {
      creep.x += (dx / d) * move;
      creep.y += (dy / d) * move;
      move = 0;
    }
  }
  aim(lane, creep);
  refreshDistance(lane, creep);
  return false;
}

/** Tick phase 4: creep movement and leaks (a leak costs the lane owner one life). */
export function updateCreeps(world: World): void {
  for (const lane of world.lanes) {
    if (lane.creeps.length === 0) continue;
    const exitIndex = cellIndex(lane, lane.exit.x, lane.exit.y);
    const survivors: SimCreep[] = [];
    for (const creep of lane.creeps) {
      if (!moveCreep(lane, creep, exitIndex)) {
        survivors.push(creep);
        continue;
      }
      const player = world.players[lane.playerId];
      if (player && player.alive) {
        player.lives -= 1;
        emit(world, {
          type: 'LifeLost',
          playerId: player.id,
          creepId: creep.id,
          livesAfter: player.lives,
        });
        if (player.lives <= 0) player.alive = false;
      }
    }
    if (survivors.length !== lane.creeps.length) {
      lane.creeps = survivors;
      dropOrphanProjectiles(lane);
    }
  }
}

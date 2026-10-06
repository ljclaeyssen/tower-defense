import { getTowerLevel, type TowerLevelDef } from '@td/shared';
import { towerCenter } from './grid.js';
import {
  allocId,
  emit,
  type SimCreep,
  type SimLane,
  type SimProjectile,
  type SimTower,
  type World,
} from './model.js';
import { toProjectileState } from './snapshot.js';

export const levelDef = (tower: SimTower): TowerLevelDef =>
  getTowerLevel(tower.type, tower.level);

function inRange(
  cx: number,
  cy: number,
  range: number,
  creep: SimCreep,
): boolean {
  const dx = creep.x - cx;
  const dy = creep.y - cy;
  return dx * dx + dy * dy <= range * range;
}

/**
 * Sticky target if still alive and in range, otherwise the in-range creep closest to the exit
 * (lowest distanceToExit, tie: lowest id).
 */
function pickTarget(
  lane: SimLane,
  tower: SimTower,
  range: number,
): SimCreep | null {
  const c = towerCenter(tower.pos);
  if (tower.targetId !== null) {
    const current = lane.creeps.find((k) => k.id === tower.targetId);
    if (current && inRange(c.x, c.y, range, current)) return current;
  }
  let best: SimCreep | null = null;
  for (const creep of lane.creeps) {
    if (!inRange(c.x, c.y, range, creep)) continue;
    if (
      best === null ||
      creep.distanceToExit < best.distanceToExit ||
      (creep.distanceToExit === best.distanceToExit && creep.id < best.id)
    ) {
      best = creep;
    }
  }
  return best;
}

/**
 * Tick phase 2: per tower (insertion order) decrement the cooldown, (re)acquire a target, fire if
 * ready. A tower with `cooldownTicks = N` therefore fires every N ticks while it has a target.
 */
export function updateTowers(world: World): void {
  for (const lane of world.lanes) {
    for (const tower of lane.towers) {
      if (tower.cooldown > 0) tower.cooldown -= 1;
      const def = levelDef(tower);
      const target = pickTarget(lane, tower, def.range);
      tower.targetId = target ? target.id : null;
      if (!target || tower.cooldown !== 0) continue;
      const c = towerCenter(tower.pos);
      const projectile: SimProjectile = {
        id: allocId(world),
        playerId: lane.playerId,
        sourceTowerId: tower.id,
        targetId: target.id,
        x: c.x,
        y: c.y,
        speed: def.projectile.speed,
        damage: def.damage,
        attack: def.attack,
        kind: def.attack.kind,
        visual: def.projectile.visual,
      };
      lane.projectiles.push(projectile);
      tower.cooldown = def.cooldownTicks;
      emit(world, {
        type: 'ProjectileFired',
        projectile: toProjectileState(projectile),
      });
    }
  }
}

import {
  DEFAULT_TARGETING,
  getTowerLevel,
  type TargetFilter,
  type TargetingDef,
  type TargetOrder,
  type TowerLevelDef,
} from '@td/shared';
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

/** True when the creep passes the filter. Adding a filter = one case here. */
function passes(filter: TargetFilter, creep: SimCreep): boolean {
  switch (filter) {
    case 'unslowed':
      return creep.slowFactor === 1;
  }
}

/**
 * Ranking score of a candidate for an order: the LOWEST score wins (ties: lowest id).
 * Adding an order = one case here. Distances use sqrt only (deterministic).
 */
function score(
  order: TargetOrder,
  creep: SimCreep,
  cx: number,
  cy: number,
): number {
  switch (order) {
    case 'first':
      return creep.distanceToExit;
    case 'last':
      return -creep.distanceToExit;
    case 'strongest':
      return -creep.hp;
    case 'weakest':
      return creep.hp;
    case 'nearest':
    case 'farthest': {
      const dx = creep.x - cx;
      const dy = creep.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      return order === 'nearest' ? d : -d;
    }
  }
}

/**
 * Generic target resolver (see `TargetingDef`):
 * 1. filters: keep the candidates passing every filter; when none passes, use all candidates;
 * 2. sticky (default true): keep the current target if it is still one of those candidates;
 * 3. otherwise the candidate with the best `order` score (metric computed once per candidate),
 *    ties broken by the lowest id.
 * `candidatesInRange` are the living creeps of the tower's lane within range.
 */
export function selectTarget(
  tower: Pick<SimTower, 'pos' | 'targetId'>,
  candidatesInRange: readonly SimCreep[],
  targeting: TargetingDef = DEFAULT_TARGETING,
): SimCreep | null {
  const filters = targeting.filters ?? [];
  let pool = candidatesInRange;
  if (filters.length > 0) {
    const passing = candidatesInRange.filter((c) =>
      filters.every((f) => passes(f, c)),
    );
    if (passing.length > 0) pool = passing;
  }
  if ((targeting.sticky ?? true) && tower.targetId !== null) {
    const current = pool.find((c) => c.id === tower.targetId);
    if (current) return current;
  }
  const center = towerCenter(tower.pos);
  let best: SimCreep | null = null;
  let bestScore = 0;
  for (const creep of pool) {
    const s = score(targeting.order, creep, center.x, center.y);
    if (
      best === null ||
      s < bestScore ||
      (s === bestScore && creep.id < best.id)
    ) {
      best = creep;
      bestScore = s;
    }
  }
  return best;
}

/** The living creeps of the lane within `range` of the tower center, in lane (id) order. */
function candidatesInRange(
  lane: SimLane,
  tower: SimTower,
  range: number,
): SimCreep[] {
  const c = towerCenter(tower.pos);
  return lane.creeps.filter((creep) => inRange(c.x, c.y, range, creep));
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
      const target = selectTarget(
        tower,
        candidatesInRange(lane, tower, def.range),
        def.targeting,
      );
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

import { addGold } from './economy.js';
import {
  emit,
  type SimCreep,
  type SimLane,
  type SimProjectile,
  type World,
} from './model.js';

/**
 * Tick phase 3: homing projectiles move `speed` cells toward the target's current position. When
 * the remaining distance is <= speed the projectile hits (`resolveImpact`) and is removed.
 * Projectiles whose target is gone (killed by another projectile or a splash, leaked) are removed
 * silently, at the latest at the end of the phase that removed the target, so a snapshot never
 * holds an orphan projectile.
 */
export function updateProjectiles(world: World): void {
  for (const lane of world.lanes) {
    if (lane.projectiles.length === 0) continue;
    const survivors: SimProjectile[] = [];
    for (const p of lane.projectiles) {
      const target = lane.creeps.find((c) => c.id === p.targetId);
      if (!target) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > p.speed) {
        p.x += (dx / d) * p.speed;
        p.y += (dy / d) * p.speed;
        survivors.push(p);
        continue;
      }
      resolveImpact(world, lane, p, target);
    }
    lane.projectiles = survivors;
    dropOrphanProjectiles(lane);
  }
}

/**
 * Deals `amount` damage to a creep of the lane: emits `CreepHit{primary}`, and when its hp drops to
 * 0 or below removes it, pays its bounty to the lane owner (`GoldChanged{kill}`) and emits
 * `CreepKilled`. No-op if the creep is no longer in the lane.
 */
export function applyDamage(
  world: World,
  lane: SimLane,
  creep: SimCreep,
  amount: number,
  projectile: SimProjectile,
  primary: boolean,
): void {
  const index = lane.creeps.indexOf(creep);
  if (index < 0) return;
  creep.hp -= amount;
  emit(world, {
    type: 'CreepHit',
    playerId: lane.playerId,
    creepId: creep.id,
    projectileId: projectile.id,
    damage: amount,
    hpAfter: creep.hp,
    primary,
  });
  if (creep.hp > 0) return;
  lane.creeps.splice(index, 1);
  addGold(world, lane.playerId, creep.bounty, 'kill');
  emit(world, {
    type: 'CreepKilled',
    playerId: lane.playerId,
    creepId: creep.id,
    bounty: creep.bounty,
  });
}

/** Secondary damage of pierce/burst: a fraction of the projectile damage, at least 1. */
const secondaryDamage = (damage: number, ratio: number): number =>
  Math.max(1, Math.floor(damage * ratio));

/**
 * Applies the projectile's attack when it reaches `target`.
 * Secondary victims are selected first, from the positions / distances at impact time (before any
 * damage), excluding the target, and are hit in ascending id order after the primary hit. Each
 * creep is hit at most once per impact, so kills happen in a deterministic order: target first,
 * then secondaries by id.
 * - single: the target only.
 * - pierce: then every creep with distanceToExit in ]target, target + behindCells].
 * - slow: then, if the target survived, factor = min(current, factor), ticks = max(current,
 *   durationTicks), `CreepSlowed` emitted with the resulting values.
 * - burst: then every creep whose center is within `splashRadius` of the target's center.
 */
export function resolveImpact(
  world: World,
  lane: SimLane,
  p: SimProjectile,
  target: SimCreep,
): void {
  const attack = p.attack;
  let victims: SimCreep[] = [];
  let splash = 0;
  if (attack.kind === 'pierce') {
    const from = target.distanceToExit;
    const to = from + attack.behindCells;
    victims = lane.creeps.filter(
      (c) => c !== target && c.distanceToExit > from && c.distanceToExit <= to,
    );
    splash = secondaryDamage(p.damage, attack.behindRatio);
  } else if (attack.kind === 'burst') {
    const r = attack.splashRadius;
    victims = lane.creeps.filter((c) => {
      if (c === target) return false;
      const dx = c.x - target.x;
      const dy = c.y - target.y;
      return Math.sqrt(dx * dx + dy * dy) <= r;
    });
    splash = secondaryDamage(p.damage, attack.splashRatio);
  }
  victims.sort((a, b) => a.id - b.id);

  applyDamage(world, lane, target, p.damage, p, true);

  if (attack.kind === 'slow' && target.hp > 0) {
    target.slowFactor = Math.min(target.slowFactor, attack.factor);
    target.slowTicks = Math.max(target.slowTicks, attack.durationTicks);
    emit(world, {
      type: 'CreepSlowed',
      playerId: lane.playerId,
      creepId: target.id,
      factor: target.slowFactor,
      ticks: target.slowTicks,
    });
  }

  for (const victim of victims)
    applyDamage(world, lane, victim, splash, p, false);
}

/** Removes projectiles whose target no longer exists in the lane (used after kills and leaks). */
export function dropOrphanProjectiles(lane: SimLane): void {
  if (lane.projectiles.length === 0) return;
  lane.projectiles = lane.projectiles.filter((p) =>
    lane.creeps.some((c) => c.id === p.targetId),
  );
}

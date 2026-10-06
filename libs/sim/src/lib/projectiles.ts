import { addGold } from './economy.js';
import { emit, type SimLane, type SimProjectile, type World } from './model.js';

/**
 * Tick phase 3: homing projectiles move `speed` cells toward the target's current position. When
 * the remaining distance is <= speed the projectile hits (and is removed). Projectiles whose
 * target is gone (killed by another projectile, leaked) are removed silently, at the latest at the
 * end of the phase that removed the target, so a snapshot never holds an orphan projectile.
 */
export function updateProjectiles(world: World): void {
  for (const lane of world.lanes) {
    if (lane.projectiles.length === 0) continue;
    const survivors: SimProjectile[] = [];
    for (const p of lane.projectiles) {
      const targetIndex = lane.creeps.findIndex((c) => c.id === p.targetId);
      const target = lane.creeps[targetIndex];
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
      target.hp -= p.damage;
      emit(world, {
        type: 'CreepHit',
        playerId: lane.playerId,
        creepId: target.id,
        projectileId: p.id,
        damage: p.damage,
        hpAfter: target.hp,
      });
      if (target.hp <= 0) {
        lane.creeps.splice(targetIndex, 1);
        addGold(world, lane.playerId, target.bounty, 'kill');
        emit(world, {
          type: 'CreepKilled',
          playerId: lane.playerId,
          creepId: target.id,
          bounty: target.bounty,
        });
      }
    }
    lane.projectiles = survivors;
    dropOrphanProjectiles(lane);
  }
}

/** Removes projectiles whose target no longer exists in the lane (used after kills and leaks). */
export function dropOrphanProjectiles(lane: SimLane): void {
  if (lane.projectiles.length === 0) return;
  lane.projectiles = lane.projectiles.filter((p) =>
    lane.creeps.some((c) => c.id === p.targetId),
  );
}

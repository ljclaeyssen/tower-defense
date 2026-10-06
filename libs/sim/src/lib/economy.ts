import { ECONOMY, type GoldChangeReason, type PlayerId } from '@td/shared';
import { emit, type World } from './model.js';

/** Adds `delta` (may be negative) to a player's gold and emits `GoldChanged`. */
export function addGold(
  world: World,
  playerId: PlayerId,
  delta: number,
  reason: GoldChangeReason,
): void {
  const player = world.players[playerId];
  if (!player) return;
  player.gold += delta;
  emit(world, {
    type: 'GoldChanged',
    playerId,
    gold: player.gold,
    delta,
    reason,
  });
}

/** Periodic income: on every tick multiple of `incomePeriodTicks` (except tick 0), alive players only. */
export function applyIncome(world: World): void {
  const period = ECONOMY.incomePeriodTicks;
  if (world.tick <= 0 || world.tick % period !== 0) return;
  for (const player of world.players) {
    if (player.alive && player.income !== 0)
      addGold(world, player.id, player.income, 'income');
  }
}

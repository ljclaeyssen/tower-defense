import { ECONOMY, WAVES, type WaveDef } from '@td/shared';
import { spawnCreep } from './creeps.js';
import {
  emit,
  isKnownCreepType,
  type SpawnEntry,
  type World,
} from './model.js';

/** PvP: spacing between the creeps of one SendCreeps command. */
export const SEND_SPACING_TICKS = 10;

/**
 * Marks `count` wave entries as spawned (or dropped). When the wave is fully spawned the countdown
 * to the next wave starts (unless it was the last wave).
 */
export function consumeWaveEntries(world: World, count: number): void {
  if (count <= 0) return;
  const { wave } = world;
  wave.remainingToSpawn = Math.max(0, wave.remainingToSpawn - count);
  if (wave.remainingToSpawn === 0 && wave.index < wave.total - 1) {
    wave.nextWaveTick = world.tick + ECONOMY.waveCountdownTicks;
  }
}

export const canStartWave = (world: World): boolean =>
  world.wave.remainingToSpawn === 0 && world.wave.index < world.wave.total - 1;

/**
 * Starts the next wave: every alive lane gets the same spawn schedule, the first creep is due on
 * the current tick. `WaveStarted.creepCount` is the total over all lanes (= remainingToSpawn).
 */
export function startWave(world: World): void {
  const { wave } = world;
  wave.index += 1;
  wave.nextWaveTick = null;
  const def: WaveDef | undefined = WAVES[wave.index];
  if (!def || !isKnownCreepType(def.creepType))
    throw new Error(`wave ${wave.index}: invalid definition`);
  const creepType = def.creepType;
  const hpMultiplier = def.hpMultiplier ?? 1;
  let queued = 0;
  for (const lane of world.lanes) {
    if (!world.players[lane.playerId]?.alive) continue;
    for (let k = 0; k < def.count; k++) {
      lane.queue.push({
        creepType,
        waveIndex: wave.index,
        hpMultiplier,
        dueTick: world.tick + k * def.spawnIntervalTicks,
        fromWave: true,
      });
      queued++;
    }
  }
  wave.remainingToSpawn = queued;
  emit(world, {
    type: 'WaveStarted',
    waveIndex: wave.index,
    creepCount: queued,
  });
  if (queued === 0 && wave.index < wave.total - 1)
    wave.nextWaveTick = world.tick + ECONOMY.waveCountdownTicks;
}

/** Tick phase 1: automatic wave start, then every due queue entry spawns (queue order). */
export function updateWaves(world: World): void {
  const { wave } = world;
  if (
    wave.nextWaveTick !== null &&
    world.tick >= wave.nextWaveTick &&
    wave.index < wave.total - 1
  ) {
    startWave(world);
  }
  let spawnedFromWave = 0;
  for (const lane of world.lanes) {
    if (lane.queue.length === 0) continue;
    const pending: SpawnEntry[] = [];
    for (const entry of lane.queue) {
      if (entry.dueTick > world.tick) {
        pending.push(entry);
        continue;
      }
      spawnCreep(world, lane, entry);
      if (entry.fromWave) spawnedFromWave++;
    }
    lane.queue = pending;
  }
  consumeWaveEntries(world, spawnedFromWave);
}

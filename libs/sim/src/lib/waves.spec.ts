import {
  CREEPS,
  ECONOMY,
  WAVES,
  isCreepTypeId,
  type GameEvent,
  type GridPos,
  type MapDef,
  type WaveDef,
} from '@td/shared';
import type { Game } from './api.js';
import { createGame } from './game.js';
import {
  OPEN_MAP,
  pveConfig,
  pvpConfig,
  runScriptedPve,
  stepN,
} from './testing.js';

/** 20x11 serpentine road (rows 0, 2, ..., 10 joined at alternating ends), ~125 cells long. */
function snakeMap(): MapDef {
  const path: GridPos[] = [];
  for (let y = 0; y <= 10; y += 2) {
    const leftToRight = y % 4 === 0;
    path.push({ x: leftToRight ? 0 : 19, y }, { x: leftToRight ? 19 : 0, y });
  }
  return {
    id: 'snake',
    width: 20,
    height: 11,
    spawn: { x: 0, y: 0 },
    exit: { x: 0, y: 10 },
    path,
  };
}

/** maxHp of the creeps of wave `waveIndex`, from that wave's own creep def. */
const expectedHp = (waveIndex: number) => {
  const wave: WaveDef | undefined = WAVES[waveIndex];
  if (!wave || !isCreepTypeId(wave.creepType))
    throw new Error(`bad wave ${waveIndex}`);
  const def = CREEPS[wave.creepType];
  return Math.round(
    def.hp * (1 + def.hpGrowthPerWave * waveIndex) * (wave.hpMultiplier ?? 1),
  );
};

/** Steps until the current wave is fully spawned; returns the events. */
function stepUntilSpawned(game: Game): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < 1000 && game.getState().wave.remainingToSpawn > 0; i++)
    events.push(...stepN(game, 1));
  return events;
}

describe('waves', () => {
  it('starts the first wave automatically at firstWaveDelayTicks', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    expect(game.getState().wave).toEqual({
      index: -1,
      total: WAVES.length,
      nextWaveTick: ECONOMY.firstWaveDelayTicks,
      remainingToSpawn: 0,
    });
    expect(
      stepN(game, ECONOMY.firstWaveDelayTicks).some(
        (e) => e.type === 'WaveStarted',
      ),
    ).toBe(false);
    const events = stepN(game, 1);
    expect(events[0]).toEqual({
      type: 'WaveStarted',
      waveIndex: 0,
      creepCount: WAVES[0]?.count,
    });
    expect(events[1]?.type).toBe('CreepSpawned');
    expect(game.getState().wave).toMatchObject({
      index: 0,
      nextWaveTick: null,
      remainingToSpawn: (WAVES[0]?.count ?? 0) - 1,
    });
  });

  it('StartWave starts early, is refused while spawning, then the countdown restarts', () => {
    const game = createGame(pveConfig(snakeMap()), 1);
    expect(game.apply({ type: 'StartWave' }, 0)).toEqual({ ok: true });
    expect(game.drainEvents()).toEqual([
      { type: 'WaveStarted', waveIndex: 0, creepCount: WAVES[0]?.count },
    ]);
    expect(game.getState().wave).toMatchObject({
      index: 0,
      nextWaveTick: null,
      remainingToSpawn: WAVES[0]?.count,
    });
    expect(game.apply({ type: 'StartWave' }, 0)).toEqual({
      ok: false,
      reason: 'NoWaveToStart',
    });

    const spawnTicks: number[] = [];
    while (game.getState().wave.remainingToSpawn > 0) {
      const tick = game.getState().tick;
      if (stepN(game, 1).some((e) => e.type === 'CreepSpawned'))
        spawnTicks.push(tick);
    }
    const w0 = WAVES[0];
    expect(spawnTicks).toEqual(
      Array.from(
        { length: w0?.count ?? 0 },
        (_, k) => k * (w0?.spawnIntervalTicks ?? 0),
      ),
    );
    const lastSpawnTick = spawnTicks.at(-1) ?? 0;
    expect(game.getState().wave.nextWaveTick).toBe(
      lastSpawnTick + ECONOMY.waveCountdownTicks,
    );

    expect(game.apply({ type: 'StartWave' }, 0)).toEqual({ ok: true });
    expect(game.getState().wave).toMatchObject({
      index: 1,
      nextWaveTick: null,
    });
  });

  it('scales creep HP per wave and refuses StartWave after the last wave', () => {
    const game = createGame(pveConfig(snakeMap()), 1);
    const maxHpByWave = new Map<number, number[]>();
    for (let w = 0; w < WAVES.length; w++) {
      expect(game.apply({ type: 'StartWave' }, 0)).toEqual({ ok: true });
      for (const e of stepUntilSpawned(game)) {
        if (e.type === 'CreepSpawned')
          maxHpByWave.set(w, [...(maxHpByWave.get(w) ?? []), e.creep.maxHp]);
      }
    }
    expect(game.getState().phase).toBe('running');
    for (let w = 0; w < WAVES.length; w++) {
      expect(maxHpByWave.get(w)).toEqual(
        new Array(WAVES[w]?.count).fill(expectedHp(w)),
      );
    }
    expect(game.getState().wave).toMatchObject({
      index: WAVES.length - 1,
      nextWaveTick: null,
      remainingToSpawn: 0,
    });
    expect(game.apply({ type: 'StartWave' }, 0)).toEqual({
      ok: false,
      reason: 'NoWaveToStart',
    });
  });

  it('StartWave is not available in PvP (waves run on the timer)', () => {
    const game = createGame(pvpConfig(OPEN_MAP), 1);
    expect(game.apply({ type: 'StartWave' }, 0)).toEqual({
      ok: false,
      reason: 'NotAvailableInMode',
    });
  });

  it('PvP lanes receive the same waves simultaneously', () => {
    const game = createGame(pvpConfig(OPEN_MAP), 1);
    const events = stepN(game, ECONOMY.firstWaveDelayTicks + 1);
    const count = WAVES[0]?.count ?? 0;
    expect(events.find((e) => e.type === 'WaveStarted')).toEqual({
      type: 'WaveStarted',
      waveIndex: 0,
      creepCount: 2 * count,
    });
    const spawned = events.filter((e) => e.type === 'CreepSpawned');
    expect(
      spawned.map((e) => e.type === 'CreepSpawned' && e.creep.playerId),
    ).toEqual([0, 1]);
  });

  it('runs exactly the 5 waves over a full game', () => {
    const { events } = runScriptedPve('humans');
    const started = events.filter((e) => e.type === 'WaveStarted');
    expect(started.map((e) => e.type === 'WaveStarted' && e.waveIndex)).toEqual(
      [0, 1, 2, 3, 4],
    );
    expect(WAVES).toHaveLength(5);
  });
});

import {
  ECONOMY,
  WAVES,
  getCreepDef,
  getMapDef,
  getTowerDef,
  type Command,
  type CommandResult,
  type GameConfig,
  type GameEvent,
  type GameState,
  type GridPos,
  type CellKind,
  type MapDef,
  type PlayerId,
  type RejectReason,
} from '@td/shared';
import type { Game } from './api.js';
import {
  laneCreepCells,
  refreshCreepDistances,
  updateCreeps,
} from './creeps.js';
import { addGold, applyIncome } from './economy.js';
import { buildCells } from './grid.js';
import { hashWorld } from './hash.js';
import {
  allocId,
  emit,
  isKnownCreepType,
  recomputeFlowField,
  type SimLane,
  type SimPlayer,
  type SimTower,
  type World,
} from './model.js';
import { checkPlacement } from './placement.js';
import { createRng } from './prng.js';
import { updateProjectiles } from './projectiles.js';
import { buildSnapshot, toTowerState } from './snapshot.js';
import { updateTowers } from './towers.js';
import {
  canStartWave,
  consumeWaveEntries,
  SEND_SPACING_TICKS,
  startWave,
  updateWaves,
} from './waves.js';

/** The cell kinds are shared by all lanes (never mutated); groundWalkable defaults to false. */
function createLane(
  playerId: PlayerId,
  map: MapDef,
  cells: readonly CellKind[],
): SimLane {
  const lane: SimLane = {
    playerId,
    width: map.width,
    height: map.height,
    spawn: { x: map.spawn.x, y: map.spawn.y },
    exit: { x: map.exit.x, y: map.exit.y },
    cells,
    groundWalkable: map.groundWalkable ?? false,
    towers: [],
    creeps: [],
    projectiles: [],
    flowField: { dist: [], next: [] },
    queue: [],
    cleared: false,
  };
  recomputeFlowField(lane);
  return lane;
}

function createWorld(config: GameConfig, seed: number): World {
  if (config.players.length === 0)
    throw new Error('createGame: at least one player is required');
  config.players.forEach((p, i) => {
    if (p.id !== i)
      throw new Error(
        `createGame: players[${i}].id must be ${i} (got ${p.id})`,
      );
  });
  const map = config.mapOverride ?? getMapDef(config.mapId);
  const cells = buildCells(map); // validates the road (spawn/exit waypoints, bounds, rocks)
  const players: SimPlayer[] = config.players.map((p) => ({
    id: p.id,
    team: p.team,
    gold: ECONOMY.startingGold,
    lives: ECONOMY.startingLives,
    income: ECONOMY.baseIncome,
    alive: true,
  }));
  return {
    config,
    seed,
    tick: 0,
    phase: 'running',
    wave: {
      index: -1,
      total: WAVES.length,
      nextWaveTick: ECONOMY.firstWaveDelayTicks,
      remainingToSpawn: 0,
    },
    players,
    lanes: players.map((p) => createLane(p.id, map, cells)),
    result: null,
    winnerId: null,
    nextId: 1,
    rng: createRng(seed),
    events: [],
  };
}

const OK: CommandResult = { ok: true };

function findTower(
  world: World,
  towerId: unknown,
): { lane: SimLane; tower: SimTower } | null {
  for (const lane of world.lanes) {
    const tower = lane.towers.find((t) => t.id === towerId);
    if (tower) return { lane, tower };
  }
  return null;
}

function placeTower(
  world: World,
  playerId: PlayerId,
  command: Extract<Command, { type: 'PlaceTower' }>,
): RejectReason | null {
  const lane = world.lanes[playerId];
  const player = world.players[playerId];
  if (!lane || !player) return 'UnknownPlayer';
  const pos: GridPos = command.pos;
  const reason = checkPlacement(
    {
      phase: world.phase,
      lane,
      gold: player.gold,
      creepCells: () => laneCreepCells(lane),
    },
    command.towerType,
    pos,
    true,
  );
  if (reason) return reason;
  const cost = getTowerDef(command.towerType).levels[0]?.cost ?? 0;
  addGold(world, playerId, -cost, 'build');
  const tower: SimTower = {
    id: allocId(world),
    playerId,
    type: command.towerType,
    level: 1,
    pos: { x: pos.x, y: pos.y },
    cooldown: 0,
    invested: cost,
    targetId: null,
  };
  lane.towers.push(tower);
  recomputeFlowField(lane);
  refreshCreepDistances(lane);
  emit(world, { type: 'TowerPlaced', tower: toTowerState(tower) });
  return null;
}

function upgradeTower(
  world: World,
  playerId: PlayerId,
  towerId: unknown,
): RejectReason | null {
  const found = findTower(world, towerId);
  if (!found) return 'TowerNotFound';
  const { tower } = found;
  if (tower.playerId !== playerId) return 'NotOwner';
  const levels = getTowerDef(tower.type).levels;
  if (tower.level >= levels.length) return 'MaxLevel';
  const cost = levels[tower.level]?.cost ?? 0;
  const player = world.players[playerId];
  if (!player || player.gold < cost) return 'NotEnoughGold';
  tower.level += 1;
  tower.invested += cost;
  addGold(world, playerId, -cost, 'upgrade');
  emit(world, {
    type: 'TowerUpgraded',
    playerId,
    towerId: tower.id,
    level: tower.level,
  });
  return null;
}

function sellTower(
  world: World,
  playerId: PlayerId,
  towerId: unknown,
): RejectReason | null {
  const found = findTower(world, towerId);
  if (!found) return 'TowerNotFound';
  const { lane, tower } = found;
  if (tower.playerId !== playerId) return 'NotOwner';
  const refund = Math.floor(tower.invested * ECONOMY.sellRefundRatio);
  // In-flight projectiles of the sold tower keep flying and still hit.
  lane.towers = lane.towers.filter((t) => t !== tower);
  recomputeFlowField(lane);
  refreshCreepDistances(lane);
  emit(world, { type: 'TowerSold', playerId, towerId: tower.id, refund });
  addGold(world, playerId, refund, 'sell');
  return null;
}

function sendCreeps(
  world: World,
  playerId: PlayerId,
  command: Extract<Command, { type: 'SendCreeps' }>,
): RejectReason | null {
  if (world.config.mode !== 'pvp') return 'NotAvailableInMode';
  if (!isKnownCreepType(command.creepType)) return 'UnknownType';
  const { count } = command;
  if (!Number.isInteger(count) || count < 1) return 'InvalidCount';
  const def = getCreepDef(command.creepType);
  const player = world.players[playerId];
  const cost = def.sendCost * count;
  if (!player || player.gold < cost) return 'NotEnoughGold';
  addGold(world, playerId, -cost, 'send');
  player.income += def.incomeBonus * count;
  // Sent creeps use the current wave's HP scaling and are NOT part of the wave counters.
  const waveIndex = Math.max(0, world.wave.index);
  for (const lane of world.lanes) {
    if (lane.playerId === playerId || !world.players[lane.playerId]?.alive)
      continue;
    for (let k = 0; k < count; k++) {
      lane.queue.push({
        creepType: command.creepType,
        waveIndex,
        hpMultiplier: 1,
        dueTick: world.tick + k * SEND_SPACING_TICKS,
        fromWave: false,
      });
    }
  }
  return null;
}

function applyCommand(
  world: World,
  command: Command,
  playerId: PlayerId,
): RejectReason | null {
  if (!Number.isInteger(playerId) || !world.players[playerId])
    return 'UnknownPlayer';
  if (command.type === 'PlaceTower')
    return placeTower(world, playerId, command);
  if (world.phase !== 'running') return 'GameNotRunning';
  switch (command.type) {
    case 'UpgradeTower':
      return upgradeTower(world, playerId, command.towerId);
    case 'SellTower':
      return sellTower(world, playerId, command.towerId);
    case 'SendCreeps':
      return sendCreeps(world, playerId, command);
    case 'StartWave':
      // PvP waves are global and run on the timer only.
      if (world.config.mode !== 'pve') return 'NotAvailableInMode';
      if (!canStartWave(world)) return 'NoWaveToStart';
      startWave(world);
      return null;
    default:
      return 'UnknownType';
  }
}

/** Empties the lane of a dead player (PvP, game still running): queue, creeps, projectiles. */
function clearDeadLanes(world: World): void {
  for (const lane of world.lanes) {
    if (lane.cleared || world.players[lane.playerId]?.alive) continue;
    const dropped = lane.queue.filter((e) => e.fromWave).length;
    lane.queue = [];
    lane.creeps = [];
    lane.projectiles = [];
    for (const t of lane.towers) t.targetId = null;
    lane.cleared = true;
    consumeWaveEntries(world, dropped);
  }
}

function endGame(
  world: World,
  result: World['result'],
  winnerId: PlayerId | null,
): void {
  world.phase = 'ended';
  world.result = result;
  world.winnerId = winnerId;
  emit(world, { type: 'GameOver', result: result ?? 'draw', winnerId });
}

/** Tick phase 6. */
function checkGameOver(world: World): void {
  const alive = world.players.filter((p) => p.alive);
  if (world.config.mode === 'pve') {
    if (alive.length === 0) {
      endGame(world, 'defeat', null);
      return;
    }
    const { wave } = world;
    const wavesDone =
      wave.index === wave.total - 1 && wave.remainingToSpawn === 0;
    const noCreeps = world.lanes.every(
      (l) => l.creeps.length === 0 && l.queue.length === 0,
    );
    if (wavesDone && noCreeps) {
      endGame(world, 'victory', alive[0]?.id ?? null);
      return;
    }
  } else {
    if (alive.length === 0) {
      endGame(world, 'draw', null);
      return;
    }
    if (alive.length === 1 && world.players.length > 1) {
      endGame(world, 'victory', alive[0]?.id ?? null);
      return;
    }
  }
  clearDeadLanes(world);
}

export function createGame(config: GameConfig, seed: number): Game {
  const world = createWorld(config, seed);
  let snapshot: GameState | null = null;

  return {
    config,
    seed,

    apply(command: Command, playerId: PlayerId): CommandResult {
      const reason = applyCommand(world, command, playerId);
      if (reason) {
        emit(world, { type: 'CommandRejected', playerId, command, reason });
        return { ok: false, reason };
      }
      snapshot = null;
      return OK;
    },

    /**
     * Advances exactly one tick (1 / TICK_RATE s). Order inside a tick:
     *  1) wave timer (auto start at `nextWaveTick`) + due spawn-queue entries spawn
     *  2) towers: cooldown -1, targeting (sticky, else closest to exit), fire when cooldown is 0
     *  3) projectiles: homing move, hits, kills + bounty
     *  4) creeps: movement along the flow field, leaks (-1 life)
     *  5) income (when tick % incomePeriodTicks === 0 and tick > 0)
     *  6) end-of-game check (PvP: lanes of dead players are emptied when the game goes on)
     *  7) tick++
     * Entities created during a tick act in the later phases of that same tick (a creep spawned in
     * phase 1 already moves in phase 4, a projectile fired in phase 2 already moves in phase 3).
     * No-op once the game has ended.
     */
    step(): void {
      if (world.phase !== 'running') return;
      updateWaves(world);
      updateTowers(world);
      updateProjectiles(world);
      updateCreeps(world);
      applyIncome(world);
      checkGameOver(world);
      world.tick += 1;
      snapshot = null;
    },

    getState(): GameState {
      if (!snapshot) snapshot = buildSnapshot(world);
      return snapshot;
    },

    drainEvents(): GameEvent[] {
      const events = world.events;
      world.events = [];
      return events;
    },

    hash(): number {
      return hashWorld(world);
    },
  };
}

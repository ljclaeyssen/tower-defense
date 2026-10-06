/**
 * Test doubles shared by the specs (not exported from the package entry point).
 */
import { DEFAULT_PVE_CONFIG } from '@td/shared';
import type {
  Command,
  CommandResult,
  GameConfig,
  GameEvent,
  GameState,
  LaneState,
  PlayerState,
  TowerState,
} from '@td/shared';
import type { Game } from '@td/sim';
import type { GameSession } from '../api.js';

export function makeLane(overrides: Partial<LaneState> = {}): LaneState {
  const width = 8;
  const height = 6;
  return {
    playerId: 0,
    width,
    height,
    spawn: { x: 0, y: 2 },
    exit: { x: 7, y: 3 },
    blocked: new Array<boolean>(width * height).fill(false),
    towers: [],
    creeps: [],
    projectiles: [],
    flowField: { dist: [], next: [] },
    ...overrides,
  };
}

export function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 0,
    team: 'blue',
    gold: 150,
    lives: 20,
    income: 10,
    alive: true,
    ...overrides,
  };
}

export function makeTower(overrides: Partial<TowerState> = {}): TowerState {
  return {
    id: 1,
    playerId: 0,
    type: 'archer',
    level: 1,
    pos: { x: 2, y: 2 },
    cooldown: 0,
    invested: 50,
    targetId: null,
    ...overrides,
  };
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    tick: 0,
    phase: 'running',
    seed: 1,
    wave: { index: -1, total: 10, nextWaveTick: 300, remainingToSpawn: 0 },
    players: [makePlayer()],
    lanes: [makeLane()],
    result: null,
    winnerId: null,
    ...overrides,
  };
}

/** Minimal deterministic Game: `step()` increments the tick, `apply()` returns a scripted result. */
export class FakeGame implements Game {
  readonly config: GameConfig = DEFAULT_PVE_CONFIG;
  readonly seed = 1;
  state: GameState = makeState();
  events: GameEvent[] = [];
  readonly applied: { command: Command; playerId: number }[] = [];
  nextResult: CommandResult = { ok: true };
  steps = 0;

  apply(command: Command, playerId: number): CommandResult {
    this.applied.push({ command, playerId });
    const result = this.nextResult;
    if (!result.ok) {
      this.events.push({
        type: 'CommandRejected',
        playerId,
        command,
        reason: result.reason,
      });
    }
    // A new snapshot object after every apply, like the real sim.
    this.state = { ...this.state };
    return result;
  }

  step(): void {
    this.steps++;
    this.state = { ...this.state, tick: this.state.tick + 1 };
  }

  getState(): GameState {
    return this.state;
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  hash(): number {
    return this.state.tick;
  }
}

/** Manually driven GameSession for bridge tests. */
export class FakeSession implements GameSession {
  readonly playerId = 0;
  state: GameState = makeState();
  events: GameEvent[] = [];
  nextResult: CommandResult = { ok: true };
  readonly applied: Command[] = [];
  private readonly listeners = new Set<(state: GameState) => void>();

  apply(command: Command): CommandResult {
    this.applied.push(command);
    if (!this.nextResult.ok) {
      this.events.push({
        type: 'CommandRejected',
        playerId: this.playerId,
        command,
        reason: this.nextResult.reason,
      });
    }
    return this.nextResult;
  }
  getState(): GameState {
    return this.state;
  }
  getPreviousState(): GameState {
    return this.state;
  }
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
  alpha(): number {
    return 0;
  }
  onTick(cb: (state: GameState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  listenerCount(): number {
    return this.listeners.size;
  }
  /** Simulates one tick with the given state. */
  tick(state: GameState = { ...this.state, tick: this.state.tick + 1 }): void {
    this.state = state;
    for (const cb of this.listeners) cb(state);
  }
  start(): void {
    /* manual */
  }
  stop(): void {
    /* manual */
  }
  destroy(): void {
    this.listeners.clear();
  }
}

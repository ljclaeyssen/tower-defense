import { TICK_MS } from '@td/shared';
import type {
  Command,
  CommandResult,
  GameEvent,
  GameState,
  PlayerId,
} from '@td/shared';
import { createGame } from '@td/sim';
import type { Game } from '@td/sim';
import type { GameSession, LocalSessionOptions } from '../api.js';

/** Maximum number of ticks simulated in one timer callback; any further backlog is dropped. */
export const MAX_CATCH_UP_TICKS = 5;

/**
 * Session whose authoritative simulation runs in the browser (PvE solo).
 *
 * A fixed-step loop driven by `setInterval(TICK_MS)` and a `performance.now()` accumulator advances
 * the sim at TICK_RATE regardless of the render frame rate. The renderer interpolates between
 * `getPreviousState()` and `getState()` with `alpha()`.
 */
class LocalSession implements GameSession {
  readonly playerId: PlayerId;
  private readonly game: Game;
  private previous: GameState;
  private current: GameState;
  private readonly tickListeners = new Set<(state: GameState) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;
  private accumulator = 0;
  /** Real time at which the latest tick is considered to have happened (for `alpha()`). */
  private lastTickTime = performance.now();
  private destroyed = false;

  constructor(options: LocalSessionOptions) {
    this.playerId = options.playerId ?? 0;
    this.game = (options.createGame ?? createGame)(
      options.config,
      options.seed,
    );
    this.current = this.game.getState();
    this.previous = this.current;
  }

  apply(command: Command): CommandResult {
    const result = this.game.apply(command, this.playerId);
    // Commands change the authoritative state immediately; keep `previous` so interpolation is not reset.
    this.current = this.game.getState();
    return result;
  }

  getState(): GameState {
    return this.current;
  }

  getPreviousState(): GameState {
    return this.previous;
  }

  drainEvents(): GameEvent[] {
    return this.game.drainEvents();
  }

  alpha(): number {
    const t = (performance.now() - this.lastTickTime) / TICK_MS;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  onTick(cb: (state: GameState) => void): () => void {
    this.tickListeners.add(cb);
    return () => {
      this.tickListeners.delete(cb);
    };
  }

  start(): void {
    if (this.timer !== null || this.destroyed) return;
    this.lastTime = performance.now();
    this.lastTickTime = this.lastTime;
    this.accumulator = 0;
    this.timer = setInterval(() => this.pump(), TICK_MS);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  destroy(): void {
    this.stop();
    this.tickListeners.clear();
    this.destroyed = true;
  }

  private pump(): void {
    const now = performance.now();
    this.accumulator += now - this.lastTime;
    this.lastTime = now;

    let ticks = 0;
    while (this.accumulator >= TICK_MS && ticks < MAX_CATCH_UP_TICKS) {
      this.accumulator -= TICK_MS;
      ticks++;
      this.tick();
      if (this.timer === null) return; // stopped or destroyed by a listener
    }
    if (this.accumulator >= TICK_MS) {
      // Too far behind (tab in background, long GC...): drop the backlog instead of fast-forwarding.
      this.accumulator = 0;
    }
    if (ticks > 0) this.lastTickTime = now - this.accumulator;
  }

  private tick(): void {
    this.previous = this.current;
    this.game.step();
    this.current = this.game.getState();
    for (const cb of this.tickListeners) cb(this.current);
  }
}

export function createLocalSession(options: LocalSessionOptions): GameSession {
  return new LocalSession(options);
}

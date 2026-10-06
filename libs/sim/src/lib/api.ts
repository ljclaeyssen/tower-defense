import type {
  Command,
  CommandResult,
  GameConfig,
  GameEvent,
  GameState,
  PlayerId,
} from '@td/shared';

/**
 * Deterministic game simulation. Pure TypeScript: no clock, no Math.random, no DOM, no Node APIs.
 * The host calls `step()` exactly TICK_RATE times per simulated second.
 */
export interface Game {
  readonly config: GameConfig;
  readonly seed: number;
  /** Validates and applies a command on behalf of `playerId`. Rejections also emit `CommandRejected`. */
  apply(command: Command, playerId: PlayerId): CommandResult;
  /** Advances the simulation by one tick. */
  step(): void;
  /** Read-only snapshot of the current state (do not mutate; may be structurally shared between calls). */
  getState(): GameState;
  /** Returns and clears the events accumulated since the previous call. */
  drainEvents(): GameEvent[];
  /** 32-bit FNV-1a hash of the canonical state, for determinism checks and desync detection. */
  hash(): number;
}

import type { PlayerId } from '@td/shared';
import type { GameSession } from '../api.js';

export interface RemoteSessionOptions {
  /** Colyseus endpoint, e.g. `ws://localhost:2567`. */
  readonly endpoint: string;
  readonly roomId: string;
  readonly playerId: PlayerId;
}

/**
 * Session whose authoritative simulation runs on the Colyseus server (PvP, phase 3).
 *
 * Planned behavior: commands are sent to the room and resolved asynchronously (`apply` returns a
 * Promise); `getState()`/`getPreviousState()` are the last two server snapshots, `alpha()` is derived
 * from their arrival times; `drainEvents()` returns the events received since the previous call;
 * `start()`/`stop()` join and leave the room. The renderer does not change.
 *
 * Not exported from the package entry point yet.
 */
export function createRemoteSession(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature of the phase 3 implementation
  _options: RemoteSessionOptions,
): GameSession {
  throw new Error('RemoteSession arrives in phase 3');
}

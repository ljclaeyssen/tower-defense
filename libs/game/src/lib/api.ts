import type {
  Command,
  CommandResult,
  GameConfig,
  GameEvent,
  GamePhase,
  GameResult,
  GameState,
  PlayerId,
  RejectReason,
  TowerState,
  TowerTypeId,
  WaveState,
} from '@td/shared';
import type { Game } from '@td/sim';

/**
 * Where the authoritative simulation lives. The renderer never knows which implementation it uses.
 * - LocalSession: sim runs in the browser (PvE solo).
 * - RemoteSession: sim runs on the Colyseus server (phase 3).
 */
export interface GameSession {
  readonly playerId: PlayerId;
  /** Sends a command on behalf of the local player. */
  apply(command: Command): CommandResult | Promise<CommandResult>;
  /** Latest authoritative state. */
  getState(): GameState;
  /** State of the previous tick, for interpolation (same object as getState() before the first tick). */
  getPreviousState(): GameState;
  /** Returns and clears the events accumulated since the previous call. */
  drainEvents(): GameEvent[];
  /** Fraction [0, 1) of the current tick already elapsed in real time, for interpolation. */
  alpha(): number;
  /** Called after every simulation tick. Returns an unsubscribe function. */
  onTick(cb: (state: GameState) => void): () => void;
  start(): void;
  stop(): void;
  destroy(): void;
}

/** HUD snapshot pushed to the host application at most once per simulation tick. */
export interface HudSnapshot {
  readonly tick: number;
  readonly phase: GamePhase;
  readonly result: GameResult | null;
  readonly gold: number;
  readonly lives: number;
  readonly income: number;
  readonly wave: WaveState;
  readonly buildMode: TowerTypeId | null;
  readonly selectedTower: TowerState | null;
  /** Cost of the next level of the selected tower, or null when none selected / max level. */
  readonly upgradeCost: number | null;
  /** Gold returned if the selected tower is sold, or null when none selected. */
  readonly sellRefund: number | null;
}

/** Typed bridge between the host application (Angular) and the Phaser game. Framework-agnostic. */
export interface GameBridge {
  readonly playerId: PlayerId;
  /** Enter/leave build mode for the given tower type (null = cancel). */
  setBuildMode(type: TowerTypeId | null): void;
  upgradeSelected(): void;
  sellSelected(): void;
  startWave(): void;
  deselect(): void;
  /** Subscribe to HUD snapshots (at most once per tick). The callback is invoked immediately with the current snapshot. */
  onHud(cb: (snapshot: HudSnapshot) => void): () => void;
  /** Subscribe to rejected commands issued by the local player. */
  onRejected(cb: (reason: RejectReason, command: Command) => void): () => void;
  /** Current snapshot, synchronously. */
  getHud(): HudSnapshot;
}

export interface LaunchGameOptions {
  /** DOM element that will host the Phaser canvas (filled to its size, resized with it). */
  readonly parent: HTMLElement;
  readonly session: GameSession;
}

export interface LaunchedGame {
  readonly bridge: GameBridge;
  /** Destroys the Phaser.Game (destroy(true)) and detaches from the session. Does not destroy the session. */
  destroy(): void;
}

export interface LaunchGalleryOptions {
  readonly parent: HTMLElement;
}

export interface LaunchedGallery {
  destroy(): void;
}

export interface LocalSessionOptions {
  readonly config: GameConfig;
  readonly seed: number;
  readonly playerId?: PlayerId;
  /** Simulation factory (defaults to `createGame` from `@td/sim`); injectable for tests. */
  readonly createGame?: (config: GameConfig, seed: number) => Game;
}

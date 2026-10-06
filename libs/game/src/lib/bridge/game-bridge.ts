import { ECONOMY, getTowerDef } from '@td/shared';
import type {
  Command,
  CommandResult,
  EntityId,
  GameEvent,
  GameState,
  LaneState,
  PlayerId,
  RejectReason,
  TowerState,
  TowerTypeId,
} from '@td/shared';
import type { GameBridge, GameSession, HudSnapshot } from '../api.js';

/** Lane owned by `playerId` (lanes are indexed by player id, but look it up defensively). */
export function findLane(
  state: GameState,
  playerId: PlayerId,
): LaneState | undefined {
  const byIndex = state.lanes[playerId];
  return byIndex?.playerId === playerId
    ? byIndex
    : state.lanes.find((l) => l.playerId === playerId);
}

export function findTower(
  state: GameState,
  playerId: PlayerId,
  towerId: EntityId | null,
): TowerState | null {
  if (towerId === null) return null;
  return (
    findLane(state, playerId)?.towers.find((t) => t.id === towerId) ?? null
  );
}

/** Cost of the next level of `tower`, or null at max level. */
export function upgradeCostOf(tower: TowerState): number | null {
  return getTowerDef(tower.type).levels[tower.level]?.cost ?? null;
}

export function sellRefundOf(tower: TowerState): number {
  return Math.floor(tower.invested * ECONOMY.sellRefundRatio);
}

/** Derives the HUD snapshot of `playerId` from an authoritative state and the local UI state. */
export function deriveHud(
  state: GameState,
  playerId: PlayerId,
  buildMode: TowerTypeId | null,
  selectedTowerId: EntityId | null,
): HudSnapshot {
  const player = state.players.find((p) => p.id === playerId);
  const selectedTower = findTower(state, playerId, selectedTowerId);
  return {
    tick: state.tick,
    phase: state.phase,
    result: state.result,
    gold: player?.gold ?? 0,
    lives: player?.lives ?? 0,
    income: player?.income ?? 0,
    wave: state.wave,
    buildMode,
    selectedTower,
    upgradeCost: selectedTower ? upgradeCostOf(selectedTower) : null,
    sellRefund: selectedTower ? sellRefundOf(selectedTower) : null,
  };
}

type Listener<A extends unknown[]> = (...args: A) => void;

function isPromise(value: unknown): value is Promise<CommandResult> {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}

/**
 * Framework-agnostic bridge between the host application and the renderer.
 *
 * It is the single consumer of `session.drainEvents()`: events are drained after every tick and after
 * every command, dispatched to `onRejected` (CommandRejected of the local player) and forwarded to
 * `onEvents` listeners (the Phaser scene buffers them for its next frame).
 *
 * HUD snapshots are pushed once per simulation tick, plus once right after a local interaction that
 * changes the build mode or the selection. Never per render frame.
 */
export class LocalGameBridge implements GameBridge {
  readonly playerId: PlayerId;
  /** Invariant: build mode and selection are mutually exclusive. */
  private buildMode: TowerTypeId | null = null;
  private selectedTowerId: EntityId | null = null;
  private hud: HudSnapshot;
  private readonly hudListeners = new Set<Listener<[HudSnapshot]>>();
  private readonly rejectedListeners = new Set<
    Listener<[RejectReason, Command]>
  >();
  private readonly changeListeners = new Set<Listener<[]>>();
  private readonly eventListeners = new Set<Listener<[readonly GameEvent[]]>>();
  /** Rejections already reported from a command result; their CommandRejected event is skipped once. */
  private pendingRejections: { type: Command['type']; reason: RejectReason }[] =
    [];
  private readonly unsubscribeTick: () => void;
  private destroyed = false;

  constructor(private readonly session: GameSession) {
    this.playerId = session.playerId;
    this.hud = deriveHud(session.getState(), this.playerId, null, null);
    this.unsubscribeTick = session.onTick((state) => this.handleTick(state));
  }

  // ---- GameBridge -------------------------------------------------------------------------------

  setBuildMode(type: TowerTypeId | null): void {
    if (type === this.buildMode) return;
    this.buildMode = type;
    if (type !== null) this.selectedTowerId = null;
    this.interactionChanged();
  }

  upgradeSelected(): void {
    if (this.selectedTowerId === null) return;
    this.issue({ type: 'UpgradeTower', towerId: this.selectedTowerId });
  }

  sellSelected(): void {
    const towerId = this.selectedTowerId;
    if (towerId === null) return;
    this.issue({ type: 'SellTower', towerId }, (result) => {
      if (result.ok && this.selectedTowerId === towerId) this.select(null);
    });
  }

  startWave(): void {
    this.issue({ type: 'StartWave' });
  }

  deselect(): void {
    this.select(null);
  }

  onHud(cb: (snapshot: HudSnapshot) => void): () => void {
    this.hudListeners.add(cb);
    cb(this.hud);
    return () => {
      this.hudListeners.delete(cb);
    };
  }

  onRejected(cb: (reason: RejectReason, command: Command) => void): () => void {
    this.rejectedListeners.add(cb);
    return () => {
      this.rejectedListeners.delete(cb);
    };
  }

  getHud(): HudSnapshot {
    return this.hud;
  }

  // ---- Renderer hooks (not part of the public GameBridge interface) ----------------------------

  getBuildMode(): TowerTypeId | null {
    return this.buildMode;
  }

  getSelectedTowerId(): EntityId | null {
    return this.selectedTowerId;
  }

  /** Selects a tower of the local player (null = deselect). Leaves build mode. */
  select(towerId: EntityId | null): void {
    if (towerId === this.selectedTowerId) return;
    this.selectedTowerId = towerId;
    if (towerId !== null) this.buildMode = null;
    this.interactionChanged();
  }

  /** Called whenever the build mode or the selection changes. */
  onChange(cb: () => void): () => void {
    this.changeListeners.add(cb);
    return () => {
      this.changeListeners.delete(cb);
    };
  }

  /** Receives every simulation event, in order, in batches. */
  onEvents(cb: (events: readonly GameEvent[]) => void): () => void {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  }

  /** Sends a command on behalf of the local player and reports a rejection through `onRejected`. */
  issue(command: Command, then?: (result: CommandResult) => void): void {
    if (this.destroyed) return;
    const handle = (result: CommandResult): void => {
      if (!result.ok) {
        this.pendingRejections.push({
          type: command.type,
          reason: result.reason,
        });
        this.emitRejected(result.reason, command);
      }
      then?.(result);
      this.flushEvents();
    };
    const result = this.session.apply(command);
    if (isPromise(result)) {
      result.then(handle, () => this.flushEvents());
    } else {
      handle(result);
    }
  }

  /** Unsubscribes from the session and drops every listener. Safe to call twice. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribeTick();
    this.hudListeners.clear();
    this.rejectedListeners.clear();
    this.changeListeners.clear();
    this.eventListeners.clear();
  }

  // ---- Internals --------------------------------------------------------------------------------

  private handleTick(state: GameState): void {
    if (this.destroyed) return;
    this.flushEvents();
    this.pendingRejections = [];
    if (
      this.selectedTowerId !== null &&
      findTower(state, this.playerId, this.selectedTowerId) === null
    ) {
      // The selected tower is gone (sold): drop the selection silently, the snapshot below reflects it.
      this.selectedTowerId = null;
      this.notifyChange();
    }
    this.pushHud(state);
  }

  private flushEvents(): void {
    if (this.destroyed) return;
    const events = this.session.drainEvents();
    if (events.length === 0) return;
    for (const event of events) {
      if (event.type !== 'CommandRejected' || event.playerId !== this.playerId)
        continue;
      const pending = this.pendingRejections.findIndex(
        (p) => p.type === event.command.type && p.reason === event.reason,
      );
      if (pending >= 0) {
        this.pendingRejections.splice(pending, 1);
      } else {
        this.emitRejected(event.reason, event.command);
      }
    }
    for (const cb of this.eventListeners) cb(events);
  }

  private emitRejected(reason: RejectReason, command: Command): void {
    for (const cb of this.rejectedListeners) cb(reason, command);
  }

  private interactionChanged(): void {
    this.notifyChange();
    this.pushHud(this.session.getState());
  }

  private notifyChange(): void {
    for (const cb of this.changeListeners) cb();
  }

  private pushHud(state: GameState): void {
    this.hud = deriveHud(
      state,
      this.playerId,
      this.buildMode,
      this.selectedTowerId,
    );
    for (const cb of this.hudListeners) cb(this.hud);
  }
}

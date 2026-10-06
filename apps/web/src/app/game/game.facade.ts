import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import type { GameBridge, HudSnapshot } from '@td/game';
import { TICK_RATE, type RejectReason, type TowerTypeId } from '@td/shared';

const REJECTION_TOAST_LIFE_MS = 2000;

/**
 * Angular-side view of the running game. Provided by the play page so it lives and dies with it.
 * Signals only change from `onHud` (at most once per simulation tick) and from user actions,
 * never from a render loop.
 */
@Injectable()
export class GameFacade {
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);

  private bridge: GameBridge | null = null;
  private subscriptions: (() => void)[] = [];

  private readonly _hud = signal<HudSnapshot | null>(null);
  private readonly _attached = signal(false);

  readonly hud = this._hud.asReadonly();
  readonly attached = this._attached.asReadonly();

  readonly gold = computed(() => this._hud()?.gold ?? 0);
  readonly lives = computed(() => this._hud()?.lives ?? 0);
  readonly income = computed(() => this._hud()?.income ?? 0);
  readonly wave = computed(() => this._hud()?.wave ?? null);
  readonly phase = computed(() => this._hud()?.phase ?? null);
  readonly result = computed(() => this._hud()?.result ?? null);
  readonly buildMode = computed(() => this._hud()?.buildMode ?? null);
  readonly selectedTower = computed(() => this._hud()?.selectedTower ?? null);
  readonly upgradeCost = computed(() => this._hud()?.upgradeCost ?? null);
  readonly sellRefund = computed(() => this._hud()?.sellRefund ?? null);

  readonly canStartWave = computed(() => {
    const hud = this._hud();
    return (
      hud !== null && hud.phase === 'running' && hud.wave.nextWaveTick !== null
    );
  });

  /** Whole seconds until the next wave starts automatically, or null when none is pending. */
  readonly secondsToNextWave = computed(() => {
    const hud = this._hud();
    const nextWaveTick = hud?.wave.nextWaveTick ?? null;
    if (hud === null || nextWaveTick === null) {
      return null;
    }
    return Math.max(0, Math.ceil((nextWaveTick - hud.tick) / TICK_RATE));
  });

  attach(bridge: GameBridge): void {
    this.detach();
    this.bridge = bridge;
    this._attached.set(true);
    this.subscriptions = [
      bridge.onHud((snapshot) => this._hud.set(snapshot)),
      bridge.onRejected((reason) => this.notifyRejected(reason)),
    ];
  }

  detach(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];
    this.bridge = null;
    this._attached.set(false);
    this._hud.set(null);
  }

  /** Enters build mode for `type`, or leaves it when that type is already active. */
  toggleBuild(type: TowerTypeId): void {
    this.bridge?.setBuildMode(this.buildMode() === type ? null : type);
  }

  cancelBuild(): void {
    this.bridge?.setBuildMode(null);
  }

  upgrade(): void {
    this.bridge?.upgradeSelected();
  }

  sell(): void {
    this.bridge?.sellSelected();
  }

  startWave(): void {
    this.bridge?.startWave();
  }

  deselect(): void {
    this.bridge?.deselect();
  }

  private notifyRejected(reason: RejectReason): void {
    this.messages.add({
      severity: 'warn',
      detail: this.translate.instant(`rejections.${reason}`),
      life: REJECTION_TOAST_LIFE_MS,
    });
  }
}

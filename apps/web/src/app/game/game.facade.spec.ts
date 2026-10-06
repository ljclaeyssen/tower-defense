import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import type { GameBridge, HudSnapshot } from '@td/game';
import type { Command, RejectReason, TowerTypeId } from '@td/shared';
import { GameFacade } from './game.facade';

const snapshot = (overrides: Partial<HudSnapshot> = {}): HudSnapshot => ({
  tick: 100,
  phase: 'running',
  result: null,
  gold: 120,
  lives: 20,
  income: 5,
  wave: { index: 0, total: 10, nextWaveTick: 200, remainingToSpawn: 0 },
  buildMode: null,
  selectedTower: null,
  upgradeCost: null,
  sellRefund: null,
  ...overrides,
});

/** In-memory bridge: records calls and lets the test push snapshots and rejections. */
class FakeBridge implements GameBridge {
  readonly playerId = 0;
  current = snapshot();
  readonly hudListeners = new Set<(s: HudSnapshot) => void>();
  readonly rejectedListeners = new Set<
    (reason: RejectReason, command: Command) => void
  >();
  readonly setBuildMode = vi.fn<(type: TowerTypeId | null) => void>();
  readonly upgradeSelected = vi.fn<() => void>();
  readonly sellSelected = vi.fn<() => void>();
  readonly startWave = vi.fn<() => void>();
  readonly deselect = vi.fn<() => void>();

  onHud(cb: (s: HudSnapshot) => void): () => void {
    this.hudListeners.add(cb);
    cb(this.current);
    return () => this.hudListeners.delete(cb);
  }

  onRejected(cb: (reason: RejectReason, command: Command) => void): () => void {
    this.rejectedListeners.add(cb);
    return () => this.rejectedListeners.delete(cb);
  }

  getHud(): HudSnapshot {
    return this.current;
  }

  push(s: HudSnapshot): void {
    this.current = s;
    this.hudListeners.forEach((cb) => cb(s));
  }

  reject(reason: RejectReason): void {
    this.rejectedListeners.forEach((cb) => cb(reason, { type: 'StartWave' }));
  }
}

describe('GameFacade', () => {
  let facade: GameFacade;
  let bridge: FakeBridge;
  let add: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    add = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        GameFacade,
        { provide: MessageService, useValue: { add } },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => `t:${key}` },
        },
      ],
    });
    facade = TestBed.inject(GameFacade);
    bridge = new FakeBridge();
  });

  it('is empty before attach', () => {
    expect(facade.attached()).toBe(false);
    expect(facade.hud()).toBeNull();
    expect(facade.canStartWave()).toBe(false);
    expect(facade.secondsToNextWave()).toBeNull();
  });

  it('maps HUD snapshots to signals', () => {
    facade.attach(bridge);
    expect(facade.attached()).toBe(true);
    expect(facade.gold()).toBe(120);
    expect(facade.lives()).toBe(20);
    expect(facade.income()).toBe(5);
    expect(facade.phase()).toBe('running');

    bridge.push(
      snapshot({
        gold: 70,
        lives: 18,
        buildMode: 'archer',
        upgradeCost: 60,
        sellRefund: 35,
      }),
    );
    expect(facade.gold()).toBe(70);
    expect(facade.lives()).toBe(18);
    expect(facade.buildMode()).toBe('archer');
    expect(facade.upgradeCost()).toBe(60);
    expect(facade.sellRefund()).toBe(35);
  });

  it('computes the next-wave countdown in whole seconds', () => {
    facade.attach(bridge);
    // 100 ticks left at 20 ticks/s.
    expect(facade.secondsToNextWave()).toBe(5);
    expect(facade.canStartWave()).toBe(true);

    bridge.push(snapshot({ tick: 181 }));
    expect(facade.secondsToNextWave()).toBe(1);

    bridge.push(
      snapshot({
        wave: { index: 9, total: 10, nextWaveTick: null, remainingToSpawn: 3 },
      }),
    );
    expect(facade.secondsToNextWave()).toBeNull();
    expect(facade.canStartWave()).toBe(false);

    bridge.push(snapshot({ phase: 'ended', result: 'victory' }));
    expect(facade.canStartWave()).toBe(false);
    expect(facade.result()).toBe('victory');
  });

  it('toggles build mode for the same type', () => {
    facade.attach(bridge);
    facade.toggleBuild('archer');
    expect(bridge.setBuildMode).toHaveBeenLastCalledWith('archer');

    bridge.push(snapshot({ buildMode: 'archer' }));
    facade.toggleBuild('archer');
    expect(bridge.setBuildMode).toHaveBeenLastCalledWith(null);

    facade.cancelBuild();
    expect(bridge.setBuildMode).toHaveBeenLastCalledWith(null);
  });

  it('forwards actions to the bridge', () => {
    facade.attach(bridge);
    facade.upgrade();
    facade.sell();
    facade.startWave();
    facade.deselect();
    expect(bridge.upgradeSelected).toHaveBeenCalledOnce();
    expect(bridge.sellSelected).toHaveBeenCalledOnce();
    expect(bridge.startWave).toHaveBeenCalledOnce();
    expect(bridge.deselect).toHaveBeenCalledOnce();
  });

  it('shows a translated warning toast on rejection', () => {
    facade.attach(bridge);
    bridge.reject('BlocksPath');
    expect(add).toHaveBeenCalledWith({
      severity: 'warn',
      detail: 't:rejections.BlocksPath',
      life: 2000,
    });
  });

  it('unsubscribes and resets on detach', () => {
    facade.attach(bridge);
    facade.detach();
    expect(bridge.hudListeners.size).toBe(0);
    expect(bridge.rejectedListeners.size).toBe(0);
    expect(facade.attached()).toBe(false);
    expect(facade.hud()).toBeNull();

    facade.toggleBuild('archer');
    expect(bridge.setBuildMode).not.toHaveBeenCalled();
  });
});

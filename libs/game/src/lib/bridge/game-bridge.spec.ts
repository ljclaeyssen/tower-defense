import { ECONOMY, getTowerDef } from '@td/shared';
import type { GameEvent } from '@td/shared';
import type { HudSnapshot } from '../api.js';
import {
  FakeSession,
  makeLane,
  makePlayer,
  makeState,
  makeTower,
} from '../testing/fake-game.js';
import { LocalGameBridge, deriveHud } from './game-bridge.js';

describe('deriveHud', () => {
  const archer = getTowerDef('archer');

  it('reads gold, lives, income, wave, phase and result of the player', () => {
    const state = makeState({
      tick: 12,
      phase: 'ended',
      result: 'victory',
      players: [makePlayer({ id: 0, gold: 321, lives: 7, income: 15 })],
      wave: { index: 2, total: 10, nextWaveTick: null, remainingToSpawn: 4 },
    });
    const hud = deriveHud(state, 0, 'archer', null);
    expect(hud).toEqual<HudSnapshot>({
      tick: 12,
      phase: 'ended',
      result: 'victory',
      gold: 321,
      lives: 7,
      income: 15,
      wave: state.wave,
      buildMode: 'archer',
      selectedTower: null,
      upgradeCost: null,
      sellRefund: null,
    });
  });

  it('picks the player matching the id in PvP', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 0, gold: 1 }),
        makePlayer({ id: 1, team: 'red', gold: 2 }),
      ],
      lanes: [
        makeLane({ playerId: 0 }),
        makeLane({ playerId: 1, towers: [makeTower({ id: 9, playerId: 1 })] }),
      ],
    });
    expect(deriveHud(state, 1, null, 9).gold).toBe(2);
    expect(deriveHud(state, 1, null, 9).selectedTower?.id).toBe(9);
    // A tower of another lane is never selected.
    expect(deriveHud(state, 0, null, 9).selectedTower).toBeNull();
  });

  it('derives the upgrade cost and the sell refund of the selected tower', () => {
    const tower = makeTower({ id: 5, level: 1, invested: 50 });
    const state = makeState({ lanes: [makeLane({ towers: [tower] })] });
    const hud = deriveHud(state, 0, null, 5);
    expect(hud.selectedTower).toBe(tower);
    expect(hud.upgradeCost).toBe(archer.levels[1]?.cost);
    expect(hud.sellRefund).toBe(Math.floor(50 * ECONOMY.sellRefundRatio));
  });

  it('reports a null upgrade cost at max level', () => {
    const level = archer.levels.length;
    const tower = makeTower({ id: 5, level, invested: 231 });
    const hud = deriveHud(
      makeState({ lanes: [makeLane({ towers: [tower] })] }),
      0,
      null,
      5,
    );
    expect(hud.upgradeCost).toBeNull();
    expect(hud.sellRefund).toBe(Math.floor(231 * ECONOMY.sellRefundRatio));
  });

  it('returns no selection when the selected id does not exist', () => {
    expect(deriveHud(makeState(), 0, null, 404).selectedTower).toBeNull();
  });
});

describe('LocalGameBridge', () => {
  let session: FakeSession;
  let bridge: LocalGameBridge;

  beforeEach(() => {
    session = new FakeSession();
    bridge = new LocalGameBridge(session);
  });

  it('calls onHud immediately, then once per tick', () => {
    const ticks: number[] = [];
    bridge.onHud((h) => ticks.push(h.tick));
    expect(ticks).toEqual([0]);
    session.tick();
    session.tick();
    expect(ticks).toEqual([0, 1, 2]);
    expect(bridge.getHud().tick).toBe(2);
  });

  it('pushes a snapshot right after build mode or selection changes, not when unchanged', () => {
    const modes: (string | null)[] = [];
    bridge.onHud((h) => modes.push(h.buildMode));
    bridge.setBuildMode('archer');
    bridge.setBuildMode('archer');
    bridge.setBuildMode(null);
    expect(modes).toEqual([null, 'archer', null]);
  });

  it('keeps build mode and selection mutually exclusive', () => {
    session.state = makeState({
      lanes: [makeLane({ towers: [makeTower({ id: 3 })] })],
    });
    const changes = vi.fn();
    bridge.onChange(changes);
    bridge.setBuildMode('archer');
    bridge.select(3);
    expect(bridge.getBuildMode()).toBeNull();
    expect(bridge.getSelectedTowerId()).toBe(3);
    expect(bridge.getHud().selectedTower?.id).toBe(3);
    bridge.setBuildMode('archer');
    expect(bridge.getSelectedTowerId()).toBeNull();
    expect(changes).toHaveBeenCalledTimes(3);
  });

  it('drops the selection when the selected tower disappears', () => {
    session.state = makeState({
      lanes: [makeLane({ towers: [makeTower({ id: 3 })] })],
    });
    bridge.select(3);
    session.tick(makeState({ tick: 1 }));
    expect(bridge.getSelectedTowerId()).toBeNull();
    expect(bridge.getHud().selectedTower).toBeNull();
  });

  it('issues upgrade, sell and start-wave commands', () => {
    session.state = makeState({
      lanes: [makeLane({ towers: [makeTower({ id: 3 })] })],
    });
    bridge.upgradeSelected(); // nothing selected: ignored
    bridge.select(3);
    bridge.upgradeSelected();
    bridge.sellSelected();
    bridge.startWave();
    expect(session.applied).toEqual([
      { type: 'UpgradeTower', towerId: 3 },
      { type: 'SellTower', towerId: 3 },
      { type: 'StartWave' },
    ]);
    // A successful sale clears the selection.
    expect(bridge.getSelectedTowerId()).toBeNull();
  });

  it('reports a rejected command once even though the sim also emits CommandRejected', () => {
    const rejected = vi.fn();
    bridge.onRejected(rejected);
    session.nextResult = { ok: false, reason: 'NotEnoughGold' };
    bridge.issue({
      type: 'PlaceTower',
      towerType: 'archer',
      pos: { x: 1, y: 1 },
    });
    session.tick();
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected).toHaveBeenCalledWith('NotEnoughGold', {
      type: 'PlaceTower',
      towerType: 'archer',
      pos: { x: 1, y: 1 },
    });
  });

  it('reports CommandRejected events of the local player only', () => {
    const rejected = vi.fn();
    bridge.onRejected(rejected);
    session.events.push(
      {
        type: 'CommandRejected',
        playerId: 1,
        command: { type: 'StartWave' },
        reason: 'NoWaveToStart',
      },
      {
        type: 'CommandRejected',
        playerId: 0,
        command: { type: 'StartWave' },
        reason: 'NoWaveToStart',
      },
    );
    session.tick();
    expect(rejected).toHaveBeenCalledTimes(1);
  });

  it('forwards every drained event to onEvents listeners', () => {
    const batches: (readonly GameEvent[])[] = [];
    bridge.onEvents((e) => batches.push(e));
    session.events.push({ type: 'WaveStarted', waveIndex: 0, creepCount: 10 });
    session.tick();
    session.tick(); // nothing to drain: no empty batch
    expect(batches).toHaveLength(1);
    expect(batches[0]?.[0]?.type).toBe('WaveStarted');
  });

  it('destroy() unsubscribes from the session and is idempotent', () => {
    const hud = vi.fn();
    bridge.onHud(hud);
    expect(session.listenerCount()).toBe(1);
    bridge.destroy();
    bridge.destroy();
    expect(session.listenerCount()).toBe(0);
    session.tick();
    expect(hud).toHaveBeenCalledTimes(1);
  });
});

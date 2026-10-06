import { DEFAULT_PVE_CONFIG, TICK_MS } from '@td/shared';
import type { GameState } from '@td/shared';
import { FakeGame } from '../testing/fake-game.js';
import { MAX_CATCH_UP_TICKS, createLocalSession } from './local-session.js';

describe('createLocalSession', () => {
  let game: FakeGame;
  /** Manual performance clock, advanced together with the fake interval timers. */
  let now: number;

  const advance = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    game = new FakeGame();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const create = (playerId?: number) =>
    createLocalSession({
      config: DEFAULT_PVE_CONFIG,
      seed: 42,
      playerId,
      createGame: () => game,
    });

  it('exposes the initial state as both current and previous before the first tick', () => {
    const session = create();
    expect(session.getState()).toBe(game.state);
    expect(session.getPreviousState()).toBe(session.getState());
    expect(session.playerId).toBe(0);
  });

  it('does not tick before start()', () => {
    create();
    advance(TICK_MS * 10);
    expect(game.steps).toBe(0);
  });

  it('steps once per TICK_MS and notifies listeners with the new state', () => {
    const session = create();
    const seen: number[] = [];
    session.onTick((s) => seen.push(s.tick));
    session.start();
    advance(TICK_MS * 3);
    expect(game.steps).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
    expect(session.getState().tick).toBe(3);
    expect(session.getPreviousState().tick).toBe(2);
  });

  it('start() is idempotent', () => {
    const session = create();
    session.start();
    session.start();
    advance(TICK_MS * 4);
    expect(game.steps).toBe(4);
  });

  it('catches up at most MAX_CATCH_UP_TICKS per callback and drops the rest', () => {
    const session = create();
    session.start();
    // Main thread frozen for ~20 ticks: the clock jumps before the next interval callback fires.
    now += TICK_MS * 19;
    advance(TICK_MS);
    expect(game.steps).toBe(MAX_CATCH_UP_TICKS);
    // The backlog was dropped: the next callback simulates a single tick.
    advance(TICK_MS);
    expect(game.steps).toBe(MAX_CATCH_UP_TICKS + 1);
  });

  it('accumulates late timer callbacks without losing ticks', () => {
    const session = create();
    session.start();
    // Each callback fires half a tick late: 1.5 ticks elapsed, then 3 in total.
    now += TICK_MS / 2;
    advance(TICK_MS);
    expect(game.steps).toBe(1);
    now += TICK_MS / 2;
    advance(TICK_MS);
    expect(game.steps).toBe(3);
  });

  it('computes alpha from the time elapsed since the last tick', () => {
    const session = create();
    session.start();
    advance(TICK_MS);
    expect(session.alpha()).toBe(0);
    advance(TICK_MS / 2 - 1);
    expect(session.alpha()).toBeCloseTo((TICK_MS / 2 - 1) / TICK_MS, 5);
    session.stop();
    advance(TICK_MS * 10);
    expect(session.alpha()).toBe(1);
  });

  it('applies commands for its player and refreshes only the current state', () => {
    const session = create(0);
    session.start();
    advance(TICK_MS * 2);
    const previous = session.getPreviousState();
    const before = session.getState();
    const result = session.apply({ type: 'StartWave' });
    expect(result).toEqual({ ok: true });
    expect(game.applied).toEqual([
      { command: { type: 'StartWave' }, playerId: 0 },
    ]);
    expect(session.getState()).not.toBe(before);
    expect(session.getState()).toBe(game.state);
    expect(session.getPreviousState()).toBe(previous);
  });

  it('returns rejections and proxies drainEvents', () => {
    const session = create();
    game.nextResult = { ok: false, reason: 'NotEnoughGold' };
    expect(session.apply({ type: 'StartWave' })).toEqual({
      ok: false,
      reason: 'NotEnoughGold',
    });
    const events = session.drainEvents();
    expect(events.map((e) => e.type)).toEqual(['CommandRejected']);
    expect(session.drainEvents()).toEqual([]);
  });

  it('stop() halts the loop and unsubscribe removes a listener', () => {
    const session = create();
    const seen: GameState[] = [];
    const unsubscribe = session.onTick((s) => seen.push(s));
    session.start();
    advance(TICK_MS);
    unsubscribe();
    advance(TICK_MS);
    expect(seen).toHaveLength(1);
    session.stop();
    advance(TICK_MS * 5);
    expect(game.steps).toBe(2);
  });

  it('destroy() stops ticking, drops listeners and prevents restarting', () => {
    const session = create();
    const listener = vi.fn();
    session.onTick(listener);
    session.start();
    session.destroy();
    session.start();
    advance(TICK_MS * 5);
    expect(game.steps).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });
});

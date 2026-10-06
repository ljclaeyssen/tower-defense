import { CREEPS, ECONOMY, WAVES } from '@td/shared';
import { runScriptedPve } from './testing.js';

describe('end-to-end balance on the basic map', () => {
  it('a game without towers ends in defeat', () => {
    const { game, events } = runScriptedPve(false);
    expect(game.getState()).toMatchObject({
      phase: 'ended',
      result: 'defeat',
      winnerId: null,
    });
    expect(events.filter((e) => e.type === 'LifeLost')).toHaveLength(
      ECONOMY.startingLives,
    );
  });

  it('3 archers along the path, upgraded as gold allows, win all 5 waves', () => {
    const { game, events } = runScriptedPve(true);
    const state = game.getState();
    expect(state).toMatchObject({
      phase: 'ended',
      result: 'victory',
      winnerId: 0,
    });
    expect(state.players[0]?.alive).toBe(true);
    expect(events.at(-1)).toEqual({
      type: 'GameOver',
      result: 'victory',
      winnerId: 0,
    });
    expect(events.filter((e) => e.type === 'WaveStarted')).toHaveLength(
      WAVES.length,
    );
    const totalCreeps = WAVES.reduce((n, w) => n + w.count, 0);
    const killed = events.filter((e) => e.type === 'CreepKilled').length;
    const leaked = events.filter((e) => e.type === 'LifeLost').length;
    expect(killed + leaked).toBe(totalCreeps);
    expect(state.players[0]?.lives).toBe(ECONOMY.startingLives - leaked);
    expect(state.lanes[0]?.towers.some((t) => t.level > 1)).toBe(true);
    // Bounties were paid for each kill.
    const bounty = events.filter(
      (e) => e.type === 'GoldChanged' && e.reason === 'kill',
    );
    expect(bounty).toHaveLength(killed);
    expect(
      bounty.every(
        (e) => e.type === 'GoldChanged' && e.delta === CREEPS.beetle.bounty,
      ),
    ).toBe(true);
  });
});

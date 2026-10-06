import { CREEPS, ECONOMY, FACTION_IDS, TOWER_ROLES, WAVES } from '@td/shared';
import { runScriptedPve } from './testing.js';

describe('end-to-end balance on the basic map', () => {
  it('a game without towers ends in defeat', () => {
    const { game, events } = runScriptedPve(null);
    expect(game.getState()).toMatchObject({
      phase: 'ended',
      result: 'defeat',
      winnerId: null,
    });
    expect(events.filter((e) => e.type === 'LifeLost')).toHaveLength(
      ECONOMY.startingLives,
    );
  });

  it.each(FACTION_IDS)(
    '%s: the scripted 4-tower build (one per role, upgraded over time) wins all 5 waves',
    (faction) => {
      const { game, events } = runScriptedPve(faction);
      const state = game.getState();
      expect(state).toMatchObject({
        phase: 'ended',
        result: 'victory',
        winnerId: 0,
      });
      expect(events.at(-1)).toEqual({
        type: 'GameOver',
        result: 'victory',
        winnerId: 0,
      });
      expect(state.players[0]?.lives).toBeGreaterThanOrEqual(5);
      expect(events.filter((e) => e.type === 'WaveStarted')).toHaveLength(
        WAVES.length,
      );

      // All four roles were built and every attack kind was used.
      const towers = state.lanes[0]?.towers ?? [];
      expect(towers).toHaveLength(TOWER_ROLES.length);
      const kinds = new Set(
        events.flatMap((e) =>
          e.type === 'ProjectileFired' ? [e.projectile.kind] : [],
        ),
      );
      expect([...kinds].sort()).toEqual([...TOWER_ROLES].sort());
      expect(towers.some((t) => t.level > 1)).toBe(true);

      // Every creep was either killed or leaked, and each kill paid its bounty.
      const totalCreeps = WAVES.reduce((n, w) => n + w.count, 0);
      const killed = events.filter((e) => e.type === 'CreepKilled').length;
      const leaked = events.filter((e) => e.type === 'LifeLost').length;
      expect(killed + leaked).toBe(totalCreeps);
      expect(state.players[0]?.lives).toBe(ECONOMY.startingLives - leaked);
      const bounty = events.filter(
        (e) => e.type === 'GoldChanged' && e.reason === 'kill',
      );
      expect(bounty).toHaveLength(killed);
      expect(
        bounty.every(
          (e) => e.type === 'GoldChanged' && e.delta === CREEPS.beetle.bounty,
        ),
      ).toBe(true);
    },
  );
});

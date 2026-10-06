import { CREEPS, ECONOMY, type GameEvent } from '@td/shared';
import { createGame } from './game.js';
import {
  LONG_MAP,
  OPEN_MAP,
  place,
  pveConfig,
  pvpConfig,
  sendToLane0,
  stepN,
} from './testing.js';

const BEETLE = CREEPS.beetle;

describe('economy', () => {
  it('grants periodic income every incomePeriodTicks (not at tick 0)', () => {
    const game = createGame(pveConfig(OPEN_MAP), 1);
    const period = ECONOMY.incomePeriodTicks;
    const early = stepN(game, period);
    expect(early.filter((e) => e.type === 'GoldChanged')).toHaveLength(0);
    const events = stepN(game, 1); // processes tick `period`
    expect(events.filter((e) => e.type === 'GoldChanged')).toEqual<GameEvent[]>(
      [
        {
          type: 'GoldChanged',
          playerId: 0,
          gold: ECONOMY.startingGold + ECONOMY.baseIncome,
          delta: ECONOMY.baseIncome,
          reason: 'income',
        },
      ],
    );
    const next = stepN(game, period);
    expect(
      next.filter((e) => e.type === 'GoldChanged' && e.reason === 'income'),
    ).toHaveLength(1);
  });

  it('credits the kill bounty to the owner of the lane', () => {
    const game = createGame(pvpConfig(LONG_MAP), 1);
    place(game, 2, 0);
    place(game, 6, 0);
    expect(sendToLane0(game, 1).ok).toBe(true);
    const events = stepN(game, 150);
    const kills = events.filter(
      (e) => e.type === 'GoldChanged' && e.reason === 'kill',
    );
    expect(kills).toEqual([
      {
        type: 'GoldChanged',
        playerId: 0,
        gold: 150 - 100 + BEETLE.bounty,
        delta: BEETLE.bounty,
        reason: 'kill',
      },
    ]);
    expect(game.getState().players[1]?.gold).toBe(150 - BEETLE.sendCost);
  });

  it('rejects unaffordable towers with NotEnoughGold', () => {
    const game = createGame(pveConfig(LONG_MAP), 1);
    expect(place(game, 2, 0).ok).toBe(true);
    expect(place(game, 4, 0).ok).toBe(true);
    expect(place(game, 6, 0).ok).toBe(true);
    expect(place(game, 8, 0)).toEqual({ ok: false, reason: 'NotEnoughGold' });
  });

  describe('SendCreeps', () => {
    it('is not available in PvE', () => {
      const game = createGame(pveConfig(OPEN_MAP), 1);
      expect(
        game.apply({ type: 'SendCreeps', creepType: 'beetle', count: 1 }, 0),
      ).toEqual({
        ok: false,
        reason: 'NotAvailableInMode',
      });
    });

    it('validates type, count and gold', () => {
      const game = createGame(pvpConfig(OPEN_MAP), 1);
      const send = (creepType: string, count: number) =>
        game.apply(
          { type: 'SendCreeps', creepType: creepType as 'beetle', count },
          1,
        );
      expect(send('dragon', 1)).toEqual({ ok: false, reason: 'UnknownType' });
      expect(send('beetle', 0)).toEqual({ ok: false, reason: 'InvalidCount' });
      expect(send('beetle', 1.5)).toEqual({
        ok: false,
        reason: 'InvalidCount',
      });
      expect(send('beetle', 1000)).toEqual({
        ok: false,
        reason: 'NotEnoughGold',
      });
    });

    it('charges sendCost * count, raises income and spawns in the other lanes 10 ticks apart', () => {
      const game = createGame(pvpConfig(OPEN_MAP), 1);
      expect(sendToLane0(game, 3)).toEqual({ ok: true });
      expect(game.drainEvents()).toEqual<GameEvent[]>([
        {
          type: 'GoldChanged',
          playerId: 1,
          gold: 150 - 3 * BEETLE.sendCost,
          delta: -3 * BEETLE.sendCost,
          reason: 'send',
        },
      ]);
      expect(game.getState().players[1]?.income).toBe(
        ECONOMY.baseIncome + 3 * BEETLE.incomeBonus,
      );
      const spawnTicks: number[] = [];
      for (let t = 0; t < 30; t++) {
        const tick = game.getState().tick;
        for (const e of stepN(game, 1)) {
          if (e.type === 'CreepSpawned') {
            expect(e.creep.playerId).toBe(0);
            spawnTicks.push(tick);
          }
        }
      }
      expect(spawnTicks).toEqual([0, 10, 20]);
      expect(game.getState().lanes[1]?.creeps).toHaveLength(0);
      // Sent creeps are not part of the wave counters.
      expect(game.getState().wave.remainingToSpawn).toBe(0);
    });
  });
});

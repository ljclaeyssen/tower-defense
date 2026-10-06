import {
  CREEP_TYPE_IDS,
  FACTION_IDS,
  TOWER_ROLES,
  TOWER_TYPE_IDS,
} from '@td/shared';
import type { World } from './model.js';

/** FNV-1a 32-bit hasher over a stream of 32-bit integers (little-endian bytes). */
export interface Hasher {
  addInt(n: number): void;
  /** Quantises `x` to 1e-6 before hashing, so tiny representation details never matter. */
  addFloat(x: number): void;
  /** Unsigned 32-bit digest. */
  digest(): number;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const TWO_POW_32 = 4294967296;

export function createHasher(): Hasher {
  let h = FNV_OFFSET;
  const addInt = (n: number): void => {
    const v = n | 0;
    h = Math.imul(h ^ (v & 0xff), FNV_PRIME);
    h = Math.imul(h ^ ((v >>> 8) & 0xff), FNV_PRIME);
    h = Math.imul(h ^ ((v >>> 16) & 0xff), FNV_PRIME);
    h = Math.imul(h ^ ((v >>> 24) & 0xff), FNV_PRIME);
  };
  return {
    addInt,
    addFloat: (x: number) => {
      // Split the quantised value in two 32-bit words so large magnitudes are not truncated.
      const q = Math.round(x * 1e6);
      const hi = Math.floor(q / TWO_POW_32);
      addInt(q - hi * TWO_POW_32);
      addInt(hi);
    },
    digest: () => h >>> 0,
  };
}

/**
 * Canonical state hash. Fixed feed order: tick, rng state, players (gold, lives, income, alive,
 * faction index), then per lane: towers (id, type index, level, pos, cooldown, invested,
 * targetId), creeps (id, type index, pos, hp, maxHp, slowFactor, slowTicks), projectiles (id, pos,
 * targetId, attack kind index in TOWER_ROLES order); finally the wave fields.
 * Collection lengths are fed before each collection; null ids are fed as -1.
 */
export function hashWorld(world: World): number {
  const h = createHasher();
  h.addInt(world.tick);
  h.addInt(world.rng.getState());
  h.addInt(world.players.length);
  for (const p of world.players) {
    h.addInt(p.gold);
    h.addInt(p.lives);
    h.addInt(p.income);
    h.addInt(p.alive ? 1 : 0);
    h.addInt(FACTION_IDS.indexOf(p.faction));
  }
  for (const lane of world.lanes) {
    h.addInt(lane.towers.length);
    for (const t of lane.towers) {
      h.addInt(t.id);
      h.addInt(TOWER_TYPE_IDS.indexOf(t.type));
      h.addInt(t.level);
      h.addInt(t.pos.x);
      h.addInt(t.pos.y);
      h.addInt(t.cooldown);
      h.addInt(t.invested);
      h.addInt(t.targetId ?? -1);
    }
    h.addInt(lane.creeps.length);
    for (const c of lane.creeps) {
      h.addInt(c.id);
      h.addInt(CREEP_TYPE_IDS.indexOf(c.type));
      h.addFloat(c.x);
      h.addFloat(c.y);
      h.addFloat(c.hp);
      h.addInt(c.maxHp);
      h.addFloat(c.slowFactor);
      h.addInt(c.slowTicks);
    }
    h.addInt(lane.projectiles.length);
    for (const p of lane.projectiles) {
      h.addInt(p.id);
      h.addFloat(p.x);
      h.addFloat(p.y);
      h.addInt(p.targetId);
      // Attack kinds share their names (and order) with TOWER_ROLES.
      h.addInt(TOWER_ROLES.indexOf(p.kind));
    }
  }
  h.addInt(world.wave.index);
  h.addInt(world.wave.total);
  h.addInt(world.wave.nextWaveTick ?? -1);
  h.addInt(world.wave.remainingToSpawn);
  return h.digest();
}

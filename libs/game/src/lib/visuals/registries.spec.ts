import {
  FACTION_IDS,
  TOWERS,
  TOWER_TYPE_IDS,
  getFactionTowers,
} from '@td/shared';
import { parseHexColor } from './color.js';
import {
  MISSING_MODEL,
  allModelIds,
  findModel,
  modelIdOf,
  resolveModel,
} from './model-registry.js';
import {
  MISSING_PROJECTILE,
  allProjectileVisualIds,
  resolveProjectile,
} from './projectile-registry.js';

describe('parseHexColor', () => {
  it('parses long and short forms, falls back on garbage', () => {
    expect(parseHexColor('#d9b45a', 0)).toBe(0xd9b45a);
    expect(parseHexColor('#fff', 0)).toBe(0xffffff);
    expect(parseHexColor('nope', 7)).toBe(7);
  });
});

describe('model registry', () => {
  it('indexes every model key of the data', () => {
    const ids = allModelIds();
    const expected = TOWER_TYPE_IDS.reduce(
      (n, t) => n + TOWERS[t].levels.length,
      0,
    );
    expect(ids).toHaveLength(expected);
    expect(findModel('human-archer-2')).toEqual({
      type: 'human-archer',
      level: 2,
    });
    expect(modelIdOf('human-archer', 3)).toBe('human-archer-3');
  });

  it('derives the shape from the role, one shape per role in every faction', () => {
    for (const faction of FACTION_IDS) {
      const shapes = getFactionTowers(faction).map(
        (t) => resolveModel(modelIdOf(t, 1)).shape,
      );
      expect(shapes).toEqual(['prism', 'spire', 'crystal', 'mortar']);
    }
  });

  it('grows with the level', () => {
    const h1 = resolveModel('human-archer-1').heightPx;
    const h3 = resolveModel('human-archer-3').heightPx;
    expect(h3).toBeGreaterThan(h1);
  });

  it('takes the accent from the faction colour and the body from the faction palette', () => {
    const human = resolveModel('human-archer-1').palette;
    expect(human.accent).toBe(0xd9b45a);
    expect(resolveModel('elf-ranger-1').palette.top).not.toBe(human.top);
  });

  it('returns the missing model for unknown keys', () => {
    expect(resolveModel('nope-9')).toBe(MISSING_MODEL);
  });
});

describe('projectile registry', () => {
  it('lists the visuals of the data without duplicates', () => {
    const ids = allProjectileVisualIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('arrow-humans');
    expect(ids).toContain('swirl-elves');
  });

  it('derives the shape from the key', () => {
    expect(resolveProjectile('arrow-humans').shape).toBe('arrow');
    expect(resolveProjectile('swirl-elves').shape).toBe('swirl');
    expect(resolveProjectile('shard-orcs').shape).toBe('shard');
    expect(resolveProjectile('boulder-undead').shape).toBe('boulder');
  });

  it('tints by faction', () => {
    expect(resolveProjectile('swirl-elves').color).not.toBe(
      resolveProjectile('swirl-orcs').color,
    );
  });

  it('returns the missing visual for unknown shapes or factions', () => {
    expect(resolveProjectile('laser-humans')).toBe(MISSING_PROJECTILE);
    expect(resolveProjectile('arrow-goblins')).toBe(MISSING_PROJECTILE);
    expect(resolveProjectile('arrow')).toBe(MISSING_PROJECTILE);
  });

  it('resolves every visual of the data', () => {
    for (const id of allProjectileVisualIds())
      expect(resolveProjectile(id)).not.toBe(MISSING_PROJECTILE);
  });
});

import {
  CREEP_TYPE_IDS,
  FACTION_IDS,
  TOWERS,
  TOWER_TYPE_IDS,
  getFactionTowers,
} from '@td/shared';
import {
  buildManifest,
  filterManifest,
  projectileVisualIds,
} from './manifest.js';
import { TEAMS } from './palette.js';

const frames = buildManifest();
const names = new Set(frames.map((f) => f.name));

describe('manifest', () => {
  it('has unique frame names', () => {
    expect(names.size).toBe(frames.length);
  });

  it('has a frame per tower model and team', () => {
    const models = TOWER_TYPE_IDS.flatMap((t) =>
      TOWERS[t].levels.map((l) => l.model),
    );
    expect(models).toHaveLength(60);
    for (const model of models)
      for (const team of TEAMS)
        expect(names).toContain(`tower/${model}/${team}`);
    expect(frames.filter((f) => f.group === 'tower')).toHaveLength(
      models.length * TEAMS.length,
    );
  });

  it('covers every faction through its towers', () => {
    for (const faction of FACTION_IDS)
      expect(getFactionTowers(faction)).toHaveLength(4);
    const sections = new Set(
      frames.filter((f) => f.group === 'tower').map((f) => f.section),
    );
    expect([...sections].sort()).toEqual([...FACTION_IDS].sort());
  });

  it('has a frame per projectile visual of the data', () => {
    const visuals = projectileVisualIds();
    expect(visuals).toHaveLength(20);
    for (const v of visuals) expect(names).toContain(`projectile/${v}`);
  });

  it('has walk frames and a shadow per creep, the ground kinds and the particle', () => {
    for (const creep of CREEP_TYPE_IDS) {
      for (let i = 0; i < 4; i++)
        expect(names).toContain(`creep/${creep}/walk/${i}`);
      expect(names).toContain(`creep/${creep}/shadow`);
    }
    for (const kind of [
      'grass-a',
      'grass-b',
      'path-a',
      'path-b',
      'rock',
      'spawn',
      'exit',
      'flash',
    ])
      expect(names).toContain(`ground/${kind}`);
    expect(names).toContain('fx/particle');
  });

  it('names follow the convention', () => {
    const patterns = [
      /^ground\/[a-z]+(-[a-z])?$/,
      /^tower\/[a-z]+-[a-z]+-\d\/(blue|red)$/,
      /^projectile\/[a-z]+-[a-z]+$/,
      /^creep\/[a-z]+\/(walk\/[0-3]|shadow)$/,
      /^fx\/[a-z]+$/,
    ];
    for (const f of frames) {
      expect(
        patterns.some((p) => p.test(f.name)),
        f.name,
      ).toBe(true);
      expect(f.name.startsWith(`${f.group}/`)).toBe(true);
    }
  });

  it('filters by prefix', () => {
    expect(filterManifest(frames, ['ground/'])).toHaveLength(8);
    expect(filterManifest(frames, ['ground/', 'fx/'])).toHaveLength(9);
    expect(filterManifest(frames, [])).toHaveLength(frames.length);
  });
});

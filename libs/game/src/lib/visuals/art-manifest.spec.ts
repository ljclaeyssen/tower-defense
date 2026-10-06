import { FACTION_IDS } from '@td/shared';
import { parseManifest, planGallery } from './art-manifest.js';
import type { ManifestFrame } from './art-manifest.js';

const frame = (
  name: string,
  group: ManifestFrame['group'],
  width = 16,
  height = 16,
): ManifestFrame => ({
  name,
  group,
  label: name,
  width,
  height,
  pivot: { x: 0.5, y: 0.5 },
});

describe('parseManifest', () => {
  it('keeps valid frames and skips malformed ones', () => {
    const m = parseManifest({
      frames: [
        {
          name: 'ground/rock',
          group: 'ground',
          label: 'Rock',
          width: 32,
          height: 18,
          pivot: { x: 0.5, y: 0.45 },
        },
        { name: 'x', group: 'nope' },
        { group: 'fx' },
        { name: 'fx/particle', group: 'fx' },
      ],
    });
    expect(m?.frames).toEqual([
      {
        name: 'ground/rock',
        group: 'ground',
        label: 'Rock',
        width: 32,
        height: 18,
        pivot: { x: 0.5, y: 0.45 },
      },
      {
        name: 'fx/particle',
        group: 'fx',
        label: 'fx/particle',
        width: 0,
        height: 0,
        pivot: { x: 0.5, y: 0.5 },
      },
    ]);
  });

  it('rejects what is not a manifest', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('<html>')).toBeNull();
    expect(parseManifest({ frames: {} })).toBeNull();
  });
});

describe('planGallery', () => {
  const manifest = {
    frames: [
      frame('ground/grass-a', 'ground', 32, 18),
      frame('creep/beetle/walk/1', 'creep'),
      frame('creep/beetle/walk/0', 'creep'),
      frame('creep/beetle/shadow', 'creep', 16, 8),
      frame('tower/human-archer-2/red', 'tower', 64, 90),
      frame('tower/human-archer-1/blue', 'tower', 64, 80),
      frame('tower/elf-ranger-1/blue', 'tower', 64, 80),
      frame('tower/goblin-1/blue', 'tower', 64, 80),
      frame('projectile/arrow-humans', 'projectile', 16, 8),
      frame('fx/particle', 'fx', 4, 4),
    ],
  };
  const atlas = [
    '__BASE',
    'ground/grass-a',
    'creep/beetle/walk/0',
    'creep/beetle/walk/1',
    'creep/beetle/shadow',
    'tower/human-archer-1/blue',
    'tower/elf-ranger-1/blue',
    'tower/goblin-1/blue',
    'projectile/arrow-humans',
    'fx/particle',
    'fx/extra',
  ];
  const plan = planGallery(manifest, atlas);

  it('groups creeps with their walk cycle in order and their shadow', () => {
    expect(plan.creeps).toHaveLength(1);
    expect(plan.creeps[0]?.id).toBe('beetle');
    expect(plan.creeps[0]?.walk.map((f) => f.name)).toEqual([
      'creep/beetle/walk/0',
      'creep/beetle/walk/1',
    ]);
    expect(plan.creeps[0]?.shadow?.name).toBe('creep/beetle/shadow');
  });

  it('lays towers out by faction (data order) -> role -> level x team', () => {
    expect(plan.factions.map((f) => f.faction)).toEqual(
      FACTION_IDS.filter((f) => f === 'humans' || f === 'elves'),
    );
    const humans = plan.factions.find((f) => f.faction === 'humans');
    expect(humans?.rows).toHaveLength(1);
    const row = humans?.rows[0];
    expect(row?.type).toBe('human-archer');
    expect(row?.role).toBe('single');
    expect(row?.cells[0]?.[0]?.name).toBe('tower/human-archer-1/blue');
    expect(row?.cells[0]?.[1]).toBeNull();
    expect(row?.cells[1]?.[1]?.name).toBe('tower/human-archer-2/red');
    expect(plan.teams).toEqual(['blue', 'red']);
  });

  it('keeps frames with unknown models aside', () => {
    expect(plan.other.map((f) => f.name)).toEqual(['tower/goblin-1/blue']);
  });

  it('reports manifest frames missing from the atlas and unlisted atlas frames', () => {
    expect([...plan.missingFromAtlas]).toEqual(['tower/human-archer-2/red']);
    expect(plan.unlisted).toEqual(['fx/extra']);
  });

  it('keeps the simple groups in manifest order', () => {
    expect(plan.ground.map((f) => f.name)).toEqual(['ground/grass-a']);
    expect(plan.projectiles.map((f) => f.name)).toEqual([
      'projectile/arrow-humans',
    ]);
    expect(plan.fx.map((f) => f.name)).toEqual(['fx/particle']);
  });
});

import {
  ATLAS_DISPLAY_SCALE,
  ATLAS_KEY,
  GROUND_FLASH_FRAME,
  PARTICLE_FRAME,
  artUrls,
  creepShadowFrameName,
  creepWalkFrameName,
  groundFrameName,
  parseAtlasJson,
  spriteRefFromFrame,
} from './atlas.js';

/** A tiny @2x atlas as written by tools/art. */
const FAKE_ATLAS = {
  frames: {
    'tower/human-archer-1/blue': {
      frame: { x: 0, y: 0, w: 128, h: 160 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 128, h: 160 },
      sourceSize: { w: 128, h: 160 },
      pivot: { x: 0.5, y: 0.8 },
    },
    'ground/grass-a': {
      frame: { x: 128, y: 0, w: 64, h: 36 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 64, h: 36 },
      sourceSize: { w: 64, h: 36 },
      pivot: { x: 0.5, y: 16 / 36 },
    },
    'fx/particle': {
      frame: { x: 192, y: 0, w: 8, h: 8 },
      rotated: false,
      trimmed: false,
      sourceSize: { w: 8, h: 8 },
    },
    'bad/rotated': {
      frame: { x: 0, y: 0, w: 8, h: 8 },
      rotated: true,
    },
    'bad/empty': { frame: { x: 0, y: 0, w: 0, h: 8 } },
  },
  meta: { scale: '2' },
};

describe('frame names', () => {
  it('follow the atlas contract', () => {
    expect(groundFrameName('path-b')).toBe('ground/path-b');
    expect(GROUND_FLASH_FRAME).toBe('ground/flash');
    expect(PARTICLE_FRAME).toBe('fx/particle');
    expect(creepWalkFrameName('beetle', 3)).toBe('creep/beetle/walk/3');
    expect(creepShadowFrameName('beetle')).toBe('creep/beetle/shadow');
  });

  it('builds the @2x atlas and manifest urls, adding a missing slash', () => {
    expect(artUrls()).toEqual({
      png: '/assets/atlas@2x.png',
      json: '/assets/atlas@2x.json',
      manifest: '/assets/manifest.json',
    });
    expect(artUrls('/nope').png).toBe('/nope/atlas@2x.png');
  });
});

describe('parseAtlasJson', () => {
  it('returns the usable frames with their pivot (centre when absent)', () => {
    const frames = parseAtlasJson(FAKE_ATLAS);
    expect(frames?.map((f) => f.name)).toEqual([
      'tower/human-archer-1/blue',
      'ground/grass-a',
      'fx/particle',
    ]);
    expect(frames?.[0]).toMatchObject({
      x: 0,
      y: 0,
      w: 128,
      h: 160,
      sourceW: 128,
      sourceH: 160,
      pivotX: 0.5,
      pivotY: 0.8,
      trimmed: false,
    });
    expect(frames?.[2]).toMatchObject({ pivotX: 0.5, pivotY: 0.5 });
  });

  it('rejects what is not an atlas (e.g. the SPA index.html fallback)', () => {
    expect(parseAtlasJson(null)).toBeNull();
    expect(parseAtlasJson('<!doctype html>')).toBeNull();
    expect(parseAtlasJson({ frames: [] })).toBeNull();
    expect(parseAtlasJson({ meta: {} })).toBeNull();
  });
});

describe('spriteRefFromFrame', () => {
  it('derives the logical size (source size / 2) and the origin (pivot) of @2x frames', () => {
    const [tower, tile] = parseAtlasJson(FAKE_ATLAS) ?? [];
    if (!tower || !tile) throw new Error('fixture');
    expect(spriteRefFromFrame(ATLAS_KEY, tower.name, tower)).toEqual({
      key: 'art',
      frame: 'tower/human-archer-1/blue',
      displayScale: ATLAS_DISPLAY_SCALE,
      width: 64,
      height: 80,
      originX: 0.5,
      originY: 0.8,
    });
    const ref = spriteRefFromFrame(ATLAS_KEY, tile.name, tile);
    expect([ref.width, ref.height]).toEqual([32, 18]);
    // The pivot lands on the diamond centre of the 32x16 tile (2 px overhang below).
    expect(ref.height * ref.originY).toBe(8);
  });

  it('supports other display scales', () => {
    const ref = spriteRefFromFrame(
      'k',
      'f',
      { sourceW: 16, sourceH: 8, pivotX: 0.25, pivotY: 1 },
      0.25,
    );
    expect(ref).toMatchObject({ width: 4, height: 2, originX: 0.25 });
  });
});

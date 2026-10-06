import { renderSprite } from '../build.js';
import { TOWER_MAX_HEIGHT, TOWER_WIDTH } from '../iso.js';
import { buildManifest } from '../manifest.js';
import type { FrameGroup } from '../manifest.js';
import type { Image } from '../png.js';

const frames = buildManifest();

/** Max alpha on the outer border (top row, left and right columns; bottom too for non-ground). */
function borderAlpha(img: Image, bottom: boolean): number {
  let max = 0;
  const a = (x: number, y: number): number =>
    img.data[(y * img.width + x) * 4 + 3] ?? 0;
  for (let x = 0; x < img.width; x++) {
    max = Math.max(max, a(x, 0));
    if (bottom) max = Math.max(max, a(x, img.height - 1));
  }
  for (let y = 0; y < img.height; y++)
    max = Math.max(max, a(0, y), a(img.width - 1, y));
  return max;
}

const LIMITS: Readonly<Record<FrameGroup, { maxW: number; maxH: number }>> = {
  ground: { maxW: 36, maxH: 28 },
  tower: { maxW: TOWER_WIDTH, maxH: TOWER_MAX_HEIGHT },
  projectile: { maxW: 16, maxH: 12 },
  creep: { maxW: 16, maxH: 16 },
  fx: { maxW: 4, maxH: 4 },
};

describe('generators', () => {
  it.each(frames.map((f) => [f.name, f] as const))(
    '%s renders within limits and is not clipped',
    (_name, f) => {
      const sprite = f.generate();
      expect(sprite.svg.startsWith('<svg')).toBe(true);
      const limit = LIMITS[f.group];
      expect(sprite.width).toBeLessThanOrEqual(limit.maxW);
      expect(sprite.height).toBeLessThanOrEqual(limit.maxH);
      expect(sprite.pivot.x / sprite.width).toBeGreaterThanOrEqual(0);
      expect(sprite.pivot.x / sprite.width).toBeLessThanOrEqual(1);
      expect(sprite.pivot.y / sprite.height).toBeGreaterThanOrEqual(0);
      expect(sprite.pivot.y / sprite.height).toBeLessThanOrEqual(1);
      const img = renderSprite(sprite, 1);
      expect(img.width).toBe(sprite.width);
      expect(img.height).toBe(sprite.height);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4)
        if ((img.data[i] ?? 0) > 0) opaque++;
      expect(opaque).toBeGreaterThan(0);
      // Nothing important touches the frame edges (soft glows may fade out there).
      if (f.group !== 'ground')
        expect(borderAlpha(img, true)).toBeLessThanOrEqual(
          f.group === 'tower' ? 8 : 90,
        );
    },
  );

  it('anchors towers on the footprint centre, 16 px above the bottom', () => {
    for (const f of frames.filter((fr) => fr.group === 'tower')) {
      const s = f.generate();
      expect(s.width).toBe(TOWER_WIDTH);
      expect(s.pivot).toEqual({ x: TOWER_WIDTH / 2, y: s.height - 16 });
    }
  });

  it('anchors tiles, creeps and projectiles at their centre / diamond centre', () => {
    for (const f of frames.filter((fr) => fr.group !== 'tower')) {
      const s = f.generate();
      expect(s.pivot.x).toBe(s.width / 2);
      if (f.name !== 'ground/rock') expect(s.pivot.y).toBe(s.height / 2);
    }
  });

  it('is deterministic', () => {
    for (const f of frames) expect(f.generate().svg).toBe(f.generate().svg);
  });
});

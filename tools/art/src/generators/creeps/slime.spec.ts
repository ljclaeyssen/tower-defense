import { CREEP_TYPE_IDS } from '@td/shared';
import { renderSprite } from '../../build.js';
import { buildManifest } from '../../manifest.js';
import { generateSlime } from './slime.js';

/** Width and height of the opaque (alpha > 50 %) bounding box. */
function extent(frame: number): { w: number; h: number } {
  const img = renderSprite(generateSlime({ frame }), 2);
  let x0 = img.width;
  let x1 = -1;
  let y0 = img.height;
  let y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

describe('slime', () => {
  it('squashes and stretches over its 4 frames', () => {
    const [round, stretched, round2, squashed] = [0, 1, 2, 3].map(extent);
    expect(stretched?.w).toBeGreaterThan(round?.w ?? 0);
    expect(stretched?.h).toBeLessThan(round?.h ?? 0);
    expect(squashed?.w).toBeLessThan(round?.w ?? 0);
    expect(squashed?.h).toBeGreaterThan(round?.h ?? 0);
    expect(round2).toEqual(round);
  });

  it('is listed only when the data declares it', () => {
    const declared = (CREEP_TYPE_IDS as readonly string[]).includes('slime');
    const names = buildManifest().map((f) => f.name);
    expect(names.includes('creep/slime/walk/0')).toBe(declared);
    expect(buildManifest({ allCreeps: true }).map((f) => f.name)).toContain(
      'creep/slime/shadow',
    );
  });
});

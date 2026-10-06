import { isPowerOfTwo, pack } from './pack.js';
import type { PackItem, PackedPage } from './pack.js';
import { rng } from './random.js';

const PADDING = 2;
const EXTRUDE = 1;

function items(count: number, seed: string, max = 120): PackItem[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    name: `f${i}`,
    width: r.int(1, max),
    height: r.int(1, max),
  }));
}

/** Every extruded cell stays inside the page with padding, and cells are ≥ padding apart. */
function assertValid(
  pages: readonly PackedPage[],
  input: readonly PackItem[],
): void {
  const seen = new Set<string>();
  for (const page of pages) {
    expect(isPowerOfTwo(page.size)).toBe(true);
    const cells = page.rects.map((r) => ({
      x0: r.x - EXTRUDE,
      y0: r.y - EXTRUDE,
      x1: r.x + r.width + EXTRUDE,
      y1: r.y + r.height + EXTRUDE,
    }));
    for (const c of cells) {
      expect(c.x0).toBeGreaterThanOrEqual(PADDING);
      expect(c.y0).toBeGreaterThanOrEqual(PADDING);
      expect(c.x1).toBeLessThanOrEqual(page.size - PADDING);
      expect(c.y1).toBeLessThanOrEqual(page.size - PADDING);
    }
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        if (!a || !b) continue;
        const apart =
          a.x1 + PADDING <= b.x0 ||
          b.x1 + PADDING <= a.x0 ||
          a.y1 + PADDING <= b.y0 ||
          b.y1 + PADDING <= a.y0;
        expect(apart).toBe(true);
      }
    for (const r of page.rects) {
      expect(seen.has(r.name)).toBe(false);
      seen.add(r.name);
      const src = input.find((i) => i.name === r.name);
      expect(r.width).toBe(src?.width);
      expect(r.height).toBe(src?.height);
    }
  }
  expect(seen.size).toBe(input.length);
}

describe('pack', () => {
  it('places every frame once, without overlap, with padding and extrusion room', () => {
    const input = items(150, 'pack-a');
    const pages = pack(input, { padding: PADDING, extrude: EXTRUDE });
    expect(pages).toHaveLength(1);
    assertValid(pages, input);
  });

  it('picks the smallest power-of-two page that fits', () => {
    const input = [{ name: 'a', width: 20, height: 20 }];
    expect(pack(input)[0]?.size).toBe(64);
    const big = [{ name: 'a', width: 100, height: 30 }];
    expect(pack(big)[0]?.size).toBe(128);
    // 100 + 2·(1 + 2) = 106 does not fit 64 but fits 128.
  });

  it('splits into several pages when the max size is exceeded', () => {
    const input = items(80, 'pack-b', 60);
    const pages = pack(input, { maxSize: 256 });
    expect(pages.length).toBeGreaterThan(1);
    assertValid(pages, input);
    for (const page of pages) expect(page.size).toBeLessThanOrEqual(256);
  });

  it('is deterministic', () => {
    const input = items(60, 'pack-c');
    expect(pack(input)).toEqual(pack([...input].reverse()));
  });

  it('rejects duplicates and frames larger than a page', () => {
    expect(() =>
      pack([
        { name: 'a', width: 1, height: 1 },
        { name: 'a', width: 2, height: 2 },
      ]),
    ).toThrow(/Duplicate/);
    expect(() =>
      pack([{ name: 'a', width: 300, height: 1 }], { maxSize: 256 }),
    ).toThrow(/does not fit/);
  });

  it('returns no page for no frame', () => {
    expect(pack([])).toEqual([]);
  });
});

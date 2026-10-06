import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from './build.js';
import { PNG_SIGNATURE } from './png.js';

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
}
interface Atlas {
  frames: Record<string, AtlasFrame>;
  meta: {
    app: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
  };
}

describe('build', () => {
  let dir = '';
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'td-art-'));
    build({
      only: ['ground/', 'creep/', 'fx/'],
      outDir: dir,
      contactSheet: false,
      sheetZoom: 2,
    });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes both atlas scales and the manifest', () => {
    expect(readdirSync(dir).sort()).toEqual([
      'atlas@1x.json',
      'atlas@1x.png',
      'atlas@2x.json',
      'atlas@2x.png',
      'manifest.json',
    ]);
    for (const s of [1, 2])
      expect(
        readFileSync(join(dir, `atlas@${s}x.png`))
          .subarray(0, 8)
          .equals(PNG_SIGNATURE),
      ).toBe(true);
  });

  it('writes Phaser JSON Hash atlases with pivots and @2x sizes doubled', () => {
    const a1 = JSON.parse(
      readFileSync(join(dir, 'atlas@1x.json'), 'utf8'),
    ) as Atlas;
    const a2 = JSON.parse(
      readFileSync(join(dir, 'atlas@2x.json'), 'utf8'),
    ) as Atlas;
    expect(a1.meta).toMatchObject({
      app: '@td/art',
      image: 'atlas@1x.png',
      format: 'RGBA8888',
      scale: '1',
    });
    expect(a2.meta.scale).toBe('2');
    expect(Object.keys(a1.frames)).toHaveLength(14);
    const g1 = a1.frames['ground/grass-a'];
    const g2 = a2.frames['ground/grass-a'];
    expect(g1).toMatchObject({
      rotated: false,
      trimmed: false,
      pivot: { x: 0.5, y: 0.5 },
    });
    expect(g1?.frame.w).toBe(36);
    expect(g2?.frame.w).toBe(72);
    expect(g2?.sourceSize).toEqual({ w: 72, h: 40 });
    for (const f of Object.values(a2.frames)) {
      expect(f.frame.x + f.frame.w).toBeLessThanOrEqual(a2.meta.size.w);
      expect(f.frame.y + f.frame.h).toBeLessThanOrEqual(a2.meta.size.h);
    }
  });
});

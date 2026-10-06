import { inflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import {
  PNG_SIGNATURE,
  blit,
  crc32,
  createImage,
  encodePng,
  extrude,
  unpremultiply,
} from './png.js';
import { rng } from './random.js';

interface Chunk {
  readonly type: string;
  readonly data: Buffer;
  readonly crcOk: boolean;
}

function readChunks(png: Buffer): Chunk[] {
  const out: Chunk[] = [];
  let p = 8;
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString('ascii', p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + len);
    const crc = png.readUInt32BE(p + 8 + len);
    out.push({
      type,
      data,
      crcOk: crc === crc32(png.subarray(p + 4, p + 8 + len)),
    });
    p += 12 + len;
  }
  return out;
}

/** Reverses the PNG scanline filters (test-side decoder). */
function unfilter(raw: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)] ?? 0;
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] ?? 0;
      const a = i >= 4 ? (out[y * stride + i - 4] ?? 0) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + i] ?? 0) : 0;
      const c = i >= 4 && y > 0 ? (out[(y - 1) * stride + i - 4] ?? 0) : 0;
      const p = a + b - c;
      const pr =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const pred = [0, a, b, (a + b) >> 1, pr][f] ?? 0;
      out[y * stride + i] = (x + pred) & 0xff;
    }
  }
  return out;
}

function noise(width: number, height: number, seed: string): Uint8Array {
  const r = rng(seed);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    // Smooth-ish gradient plus noise so every filter type gets used.
    const x = (i / 4) % width;
    data[i] = (x * 7) & 0xff;
    data[i + 1] = r.int(0, 255);
    data[i + 2] = ((i / 4 / width) * 13) & 0xff;
    data[i + 3] = 255;
  }
  return data;
}

describe('crc32', () => {
  it('matches the reference check value', () => {
    expect(crc32(Buffer.from('123456789', 'ascii'))).toBe(0xcbf43926);
  });
});

describe('encodePng', () => {
  it('writes a valid signature, IHDR, IDAT, IEND with correct CRCs', () => {
    const png = encodePng(5, 3, noise(5, 3, 'a'));
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    const chunks = readChunks(png);
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(chunks.every((c) => c.crcOk)).toBe(true);
    const ihdr = chunks[0]?.data;
    expect(ihdr?.readUInt32BE(0)).toBe(5);
    expect(ihdr?.readUInt32BE(4)).toBe(3);
    expect([...(ihdr?.subarray(8) ?? [])]).toEqual([8, 6, 0, 0, 0]);
  });

  it('round-trips the pixels through deflate and the scanline filters', () => {
    const w = 37;
    const h = 19;
    const pixels = noise(w, h, 'b');
    const idat = readChunks(encodePng(w, h, pixels)).find(
      (c) => c.type === 'IDAT',
    );
    const raw = inflateSync(idat?.data ?? Buffer.alloc(0));
    expect(raw.length).toBe((w * 4 + 1) * h);
    expect(Buffer.from(unfilter(raw, w, h)).equals(Buffer.from(pixels))).toBe(
      true,
    );
  });

  it('is decoded by resvg to the same pixels', () => {
    const w = 8;
    const h = 6;
    const pixels = noise(w, h, 'c');
    const png = encodePng(w, h, pixels);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
    const out = new Resvg(svg, { font: { loadSystemFonts: false } }).render()
      .pixels;
    expect(Buffer.from(out).equals(Buffer.from(pixels))).toBe(true);
  });

  it('rejects a buffer of the wrong size', () => {
    expect(() => encodePng(2, 2, new Uint8Array(3))).toThrow();
  });
});

describe('pixel helpers', () => {
  it('unpremultiplies colour channels', () => {
    expect([
      ...unpremultiply(new Uint8Array([128, 64, 0, 128, 10, 10, 10, 0])),
    ]).toEqual([255, 128, 0, 128, 10, 10, 10, 0]);
  });

  it('blits and extrudes the border pixels outward', () => {
    const page = createImage(6, 6);
    const src = createImage(2, 2);
    src.data.set([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]);
    blit(page, src, 2, 2);
    extrude(page, 2, 2, 2, 2, 1);
    const at = (x: number, y: number): number =>
      page.data[(y * 6 + x) * 4] ?? -1;
    expect([at(2, 1), at(3, 1)]).toEqual([1, 2]); // top
    expect([at(2, 4), at(3, 4)]).toEqual([3, 4]); // bottom
    expect([at(1, 2), at(1, 3)]).toEqual([1, 3]); // left
    expect([at(4, 2), at(4, 3)]).toEqual([2, 4]); // right
    expect([at(1, 1), at(4, 1), at(1, 4), at(4, 4)]).toEqual([1, 2, 3, 4]); // corners
    expect(at(0, 0)).toBe(0);
  });
});

/**
 * Minimal PNG encoder (8-bit RGBA, non-interlaced) on top of node:zlib, plus the pixel helpers the
 * build needs (resvg returns premultiplied RGBA, PNG stores straight alpha).
 */
import { deflateSync } from 'node:zlib';

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (ISO-HDLC, as used by PNG chunks). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = (CRC_TABLE[(c ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Filters every scanline with the filter (None, Sub, Up, Average, Paeth) whose output has the
 * smallest sum of absolute signed bytes (the classic libpng heuristic).
 */
function filterScanlines(
  width: number,
  height: number,
  rgba: Uint8Array,
): Uint8Array {
  const stride = width * 4;
  const out = new Uint8Array((stride + 1) * height);
  const candidate = new Uint8Array(stride);
  const best = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const prev = row - stride;
    let bestScore = Infinity;
    let bestFilter = 0;
    for (let f = 0; f < 5; f++) {
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const x = rgba[row + i] ?? 0;
        const a = i >= 4 ? (rgba[row + i - 4] ?? 0) : 0;
        const b = y > 0 ? (rgba[prev + i] ?? 0) : 0;
        const c = i >= 4 && y > 0 ? (rgba[prev + i - 4] ?? 0) : 0;
        const v =
          f === 0
            ? x
            : f === 1
              ? x - a
              : f === 2
                ? x - b
                : f === 3
                  ? x - ((a + b) >> 1)
                  : x - paeth(a, b, c);
        const byte = v & 0xff;
        candidate[i] = byte;
        score += byte < 128 ? byte : 256 - byte;
        if (score >= bestScore) break;
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = f;
        best.set(candidate);
      }
    }
    const o = y * (stride + 1);
    out[o] = bestFilter;
    out.set(best, o + 1);
  }
  return out;
}

/** Encodes straight-alpha RGBA pixels as a PNG file. */
export function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Buffer {
  if (width <= 0 || height <= 0)
    throw new Error(`Invalid PNG size ${width}x${height}`);
  if (rgba.length !== width * height * 4)
    throw new Error(`Expected ${width * height * 4} bytes, got ${rgba.length}`);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace
  const idat = deflateSync(filterScanlines(width, height, rgba), { level: 9 });
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Premultiplied → straight alpha, in place. */
export function unpremultiply(rgba: Uint8Array): Uint8Array {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] ?? 0;
    if (a === 0 || a === 255) continue;
    for (let k = 0; k < 3; k++)
      rgba[i + k] = Math.min(255, Math.round(((rgba[i + k] ?? 0) * 255) / a));
  }
  return rgba;
}

/** RGBA image buffer. */
export interface Image {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export function createImage(width: number, height: number): Image {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Copies `src` into `dst` at (x, y) (no blending, clipped to the destination). */
export function blit(dst: Image, src: Image, x: number, y: number): void {
  for (let row = 0; row < src.height; row++) {
    const dy = y + row;
    if (dy < 0 || dy >= dst.height) continue;
    const x0 = Math.max(0, x);
    const x1 = Math.min(dst.width, x + src.width);
    if (x1 <= x0) continue;
    const s = (row * src.width + (x0 - x)) * 4;
    dst.data.set(
      src.data.subarray(s, s + (x1 - x0) * 4),
      (dy * dst.width + x0) * 4,
    );
  }
}

/**
 * Duplicates the border pixels of the rectangle (x, y, w, h) outward by `amount` px (edge
 * extrusion), so linear filtering and mipmaps sample the frame's own colours instead of neighbours.
 */
export function extrude(
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  amount: number,
): void {
  const px = (ix: number, iy: number): number => (iy * img.width + ix) * 4;
  const copy = (sx: number, sy: number, dx: number, dy: number): void => {
    if (dx < 0 || dy < 0 || dx >= img.width || dy >= img.height) return;
    img.data.copyWithin(px(dx, dy), px(sx, sy), px(sx, sy) + 4);
  };
  for (let e = 1; e <= amount; e++) {
    for (let i = 0; i < w; i++) {
      copy(x + i, y, x + i, y - e);
      copy(x + i, y + h - 1, x + i, y + h - 1 + e);
    }
    for (let j = -amount; j < h + amount; j++) {
      const sy = Math.min(Math.max(y + j, y), y + h - 1);
      copy(x, sy, x - e, y + j);
      copy(x + w - 1, sy, x + w - 1 + e, y + j);
    }
  }
}

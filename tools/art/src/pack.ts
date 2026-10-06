/**
 * Shelf (row) packer for the atlas. Pure: sizes in, positions out.
 * Each frame occupies its own size plus `extrude` px on every side (duplicated border pixels), and
 * `padding` px of empty space separates the extruded cells from each other and from the page edge.
 * Pages are square powers of two: the smallest page that holds everything, else several `maxSize`
 * pages.
 */

export interface PackItem {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

/** Position of a frame's content (extrusion excluded) on its page. */
export interface PackedRect extends PackItem {
  readonly x: number;
  readonly y: number;
}

export interface PackedPage {
  readonly size: number;
  readonly rects: readonly PackedRect[];
}

export interface PackOptions {
  readonly padding?: number;
  readonly extrude?: number;
  readonly minSize?: number;
  readonly maxSize?: number;
}

export const DEFAULT_PACK_OPTIONS = {
  padding: 2,
  extrude: 1,
  minSize: 64,
  maxSize: 4096,
} as const satisfies Required<PackOptions>;

export const isPowerOfTwo = (n: number): boolean =>
  n > 0 && (n & (n - 1)) === 0;

/** Deterministic order: tallest first, then widest, then by name. */
function sortItems(items: readonly PackItem[]): PackItem[] {
  return [...items].sort(
    (a, b) =>
      b.height - a.height ||
      b.width - a.width ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

/** Fills one page of `size`; returns the placed rects and the items that did not fit. */
function shelfPack(
  items: readonly PackItem[],
  size: number,
  padding: number,
  extrude: number,
): { placed: PackedRect[]; rest: PackItem[] } {
  const placed: PackedRect[] = [];
  const rest: PackItem[] = [];
  let x = padding;
  let y = padding;
  let shelf = 0;
  for (const item of items) {
    const w = item.width + 2 * extrude;
    const h = item.height + 2 * extrude;
    if (x + w + padding > size && x > padding) {
      y += shelf + padding;
      x = padding;
      shelf = 0;
    }
    if (x + w + padding > size || y + h + padding > size) {
      rest.push(item);
      continue;
    }
    placed.push({ ...item, x: x + extrude, y: y + extrude });
    x += w + padding;
    shelf = Math.max(shelf, h);
  }
  return { placed, rest };
}

export function pack(
  items: readonly PackItem[],
  options: PackOptions = {},
): PackedPage[] {
  const o = { ...DEFAULT_PACK_OPTIONS, ...options };
  if (!isPowerOfTwo(o.minSize) || !isPowerOfTwo(o.maxSize))
    throw new Error('Page sizes must be powers of two');
  const names = new Set<string>();
  for (const item of items) {
    if (names.has(item.name))
      throw new Error(`Duplicate frame name ${item.name}`);
    names.add(item.name);
    if (item.width <= 0 || item.height <= 0)
      throw new Error(`Empty frame ${item.name}`);
    const need =
      Math.max(item.width, item.height) + 2 * (o.extrude + o.padding);
    if (need > o.maxSize)
      throw new Error(`Frame ${item.name} does not fit a ${o.maxSize} page`);
  }
  if (items.length === 0) return [];
  const sorted = sortItems(items);
  for (let size = o.minSize; size <= o.maxSize; size *= 2) {
    const { placed, rest } = shelfPack(sorted, size, o.padding, o.extrude);
    if (rest.length === 0) return [{ size, rects: placed }];
  }
  const pages: PackedPage[] = [];
  let remaining = sorted;
  while (remaining.length > 0) {
    const { placed, rest } = shelfPack(
      remaining,
      o.maxSize,
      o.padding,
      o.extrude,
    );
    if (rest.length === 0) {
      // Last page: the smallest size that still holds the leftovers.
      for (let size = o.minSize; size <= o.maxSize; size *= 2) {
        const fit = shelfPack(remaining, size, o.padding, o.extrude);
        if (fit.rest.length === 0) {
          pages.push({ size, rects: fit.placed });
          break;
        }
      }
    } else pages.push({ size: o.maxSize, rects: placed });
    remaining = rest;
  }
  return pages;
}

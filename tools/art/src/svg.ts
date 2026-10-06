/**
 * Tiny typed SVG builder: elements are plain strings, attributes are objects, `Defs` collects
 * gradients / filters / clip paths with deduplicated ids. Numbers are rounded to 3 decimals so the
 * output is stable and compact.
 */

export type Pt = readonly [number, number];
export type AttrValue = string | number | undefined | null | false;
export type Attrs = Readonly<Record<string, AttrValue>>;
export type Child = string | undefined | null | false | readonly Child[];

/** Stable number formatting (3 decimals, no trailing zeros, no "-0"). */
export function num(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`Non-finite SVG number: ${v}`);
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const escapeText = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function flatten(children: readonly Child[]): string {
  let out = '';
  for (const c of children) {
    if (!c) continue;
    out += typeof c === 'string' ? c : flatten(c);
  }
  return out;
}

function attrString(attrs: Attrs): string {
  let out = '';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    out += ` ${k}="${typeof v === 'number' ? num(v) : escapeAttr(v)}"`;
  }
  return out;
}

/** Generic element; empty bodies self-close. */
export function el(
  tag: string,
  attrs: Attrs = {},
  ...children: Child[]
): string {
  const body = flatten(children);
  const a = attrString(attrs);
  return body ? `<${tag}${a}>${body}</${tag}>` : `<${tag}${a}/>`;
}

export const pts = (points: readonly Pt[]): string =>
  points.map(([x, y]) => `${num(x)},${num(y)}`).join(' ');

/** "M x y L x y … Z" path data. */
export function pathD(points: readonly Pt[], closed = true): string {
  const body = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
    .join(' ');
  return closed ? `${body} Z` : body;
}

export const group = (attrs: Attrs, ...children: Child[]): string =>
  el('g', attrs, ...children);
export const polygon = (points: readonly Pt[], attrs: Attrs = {}): string =>
  el('polygon', { points: pts(points), ...attrs });
export const polyline = (points: readonly Pt[], attrs: Attrs = {}): string =>
  el('polyline', { points: pts(points), fill: 'none', ...attrs });
export const path = (d: string, attrs: Attrs = {}): string =>
  el('path', { d, ...attrs });
export const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  attrs: Attrs = {},
): string => el('rect', { x, y, width, height, ...attrs });
export const circle = (
  cx: number,
  cy: number,
  r: number,
  attrs: Attrs = {},
): string => el('circle', { cx, cy, r, ...attrs });
export const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  attrs: Attrs = {},
): string => el('ellipse', { cx, cy, rx, ry, ...attrs });
export const line = (a: Pt, b: Pt, attrs: Attrs = {}): string =>
  el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...attrs });
export const text = (
  x: number,
  y: number,
  content: string,
  attrs: Attrs = {},
): string => el('text', { x, y, ...attrs }, escapeText(content));
export const image = (
  x: number,
  y: number,
  width: number,
  height: number,
  href: string,
  attrs: Attrs = {},
): string => el('image', { x, y, width, height, href, ...attrs });

// Transforms ------------------------------------------------------------------------------------

export const translate = (x: number, y: number): string =>
  `translate(${num(x)} ${num(y)})`;
export const rotate = (deg: number, cx = 0, cy = 0): string =>
  `rotate(${num(deg)} ${num(cx)} ${num(cy)})`;
export const scale = (sx: number, sy = sx): string =>
  `scale(${num(sx)} ${num(sy)})`;
export const skewX = (deg: number): string => `skewX(${num(deg)})`;
export const skewY = (deg: number): string => `skewY(${num(deg)})`;
export const matrix = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): string => `matrix(${[a, b, c, d, e, f].map(num).join(' ')})`;
export const transforms = (
  ...parts: readonly (string | false | undefined)[]
): string => parts.filter(Boolean).join(' ');

// Defs ------------------------------------------------------------------------------------------

/** Gradient stop: [offset 0..1, colour, opacity?]. */
export type Stop = readonly [number, string, number?];

export interface LinearOptions {
  readonly x1?: number;
  readonly y1?: number;
  readonly x2?: number;
  readonly y2?: number;
  /** Default objectBoundingBox (coordinates 0..1 of the shape). */
  readonly userSpace?: boolean;
}

export interface RadialOptions {
  readonly cx?: number;
  readonly cy?: number;
  readonly r?: number;
  readonly fx?: number;
  readonly fy?: number;
  readonly userSpace?: boolean;
}

const stopEls = (stops: readonly Stop[]): string[] =>
  stops.map(([offset, colour, opacity]) =>
    el('stop', {
      offset,
      'stop-color': colour,
      'stop-opacity':
        opacity === undefined || opacity === 1 ? undefined : opacity,
    }),
  );

/** Per-document definitions; every helper returns a `url(#id)` reference, identical defs are shared. */
export class Defs {
  private readonly items: string[] = [];
  private readonly ids = new Map<string, string>();

  constructor(private readonly prefix = 'd') {}

  private add(key: string, build: (id: string) => string): string {
    let id = this.ids.get(key);
    if (!id) {
      id = `${this.prefix}${this.ids.size}`;
      this.ids.set(key, id);
      this.items.push(build(id));
    }
    return `url(#${id})`;
  }

  linear(stops: readonly Stop[], o: LinearOptions = {}): string {
    const attrs = {
      x1: o.x1 ?? 0,
      y1: o.y1 ?? 0,
      x2: o.x2 ?? 1,
      y2: o.y2 ?? 0,
      gradientUnits: o.userSpace ? 'userSpaceOnUse' : undefined,
    };
    return this.add(`lin${JSON.stringify([stops, attrs])}`, (id) =>
      el('linearGradient', { id, ...attrs }, stopEls(stops)),
    );
  }

  radial(stops: readonly Stop[], o: RadialOptions = {}): string {
    const attrs = {
      cx: o.cx ?? 0.5,
      cy: o.cy ?? 0.5,
      r: o.r ?? 0.5,
      fx: o.fx,
      fy: o.fy,
      gradientUnits: o.userSpace ? 'userSpaceOnUse' : undefined,
    };
    return this.add(`rad${JSON.stringify([stops, attrs])}`, (id) =>
      el('radialGradient', { id, ...attrs }, stopEls(stops)),
    );
  }

  /** Gaussian blur filter with a generous region so glows are not clipped. */
  blur(stdDeviation: number): string {
    return this.add(`blur${stdDeviation}`, (id) =>
      el(
        'filter',
        { id, x: '-100%', y: '-100%', width: '300%', height: '300%' },
        el('feGaussianBlur', { stdDeviation }),
      ),
    );
  }

  /** Clip path from raw SVG content (userSpaceOnUse). */
  clip(content: string): string {
    return this.add(`clip${content}`, (id) => el('clipPath', { id }, content));
  }

  toString(): string {
    return this.items.length ? el('defs', {}, this.items) : '';
  }
}

/** Serialises a complete SVG document of the given logical size. */
export function svgDoc(
  width: number,
  height: number,
  body: Child,
  defs?: Defs,
): string {
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width,
      height,
      viewBox: `0 0 ${num(width)} ${num(height)}`,
    },
    defs?.toString(),
    body,
  );
}

/**
 * Ground tiles: a 32×16 diamond centred in a 36×20 canvas. The base fill overhangs the diamond by
 * 2 px horizontally (1 px vertically) so adjacent tiles never show seams; details stay inside.
 */
import { HALF_H, HALF_W } from '../iso.js';
import { GROUND, mix, shade } from '../palette.js';
import type { Hex } from '../palette.js';
import { rng } from '../random.js';
import type { Rng } from '../random.js';
import {
  Defs,
  ellipse,
  group,
  line,
  path,
  pathD,
  polygon,
  svgDoc,
} from '../svg.js';
import type { Pt } from '../svg.js';
import type { Sprite } from './types.js';

export const GROUND_KINDS = [
  'grass-a',
  'grass-b',
  'path-a',
  'path-b',
  'rock',
  'spawn',
  'exit',
  'flash',
] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];

const OVERHANG = 2;
export const TILE_CANVAS_W = 2 * HALF_W + 2 * OVERHANG;
export const TILE_CANVAS_H = 2 * HALF_H + 2 * OVERHANG;

const diamond = (cx: number, cy: number, hw: number, hh: number): Pt[] => [
  [cx, cy - hh],
  [cx + hw, cy],
  [cx, cy + hh],
  [cx - hw, cy],
];

/** Random point inside the diamond scaled by `k`. */
function pointIn(r: Rng, cx: number, cy: number, k: number): Pt {
  for (;;) {
    const u = r.range(-1, 1);
    const v = r.range(-1, 1);
    if (Math.abs(u) + Math.abs(v) <= 1)
      return [cx + u * HALF_W * k, cy + v * HALF_H * k];
  }
}

interface TileCtx {
  readonly defs: Defs;
  readonly cx: number;
  readonly cy: number;
}

/** Base diamond (with overhang) shaded from the lit left to the darker right. */
function base(t: TileCtx, colour: Hex): string {
  const fill = t.defs.linear([
    [0, shade(colour, 1.06)],
    [1, shade(colour, 0.93)],
  ]);
  return polygon(
    diamond(t.cx, t.cy, HALF_W + OVERHANG, HALF_H + OVERHANG / 2),
    { fill },
  );
}

function grass(t: TileCtx, colour: Hex, seed: string): string {
  const r = rng(seed);
  const out = [base(t, colour)];
  // Soft tonal patches.
  for (let i = 0; i < 3; i++) {
    const [x, y] = pointIn(r, t.cx, t.cy, 0.6);
    out.push(
      ellipse(x, y, r.range(3, 6), r.range(1.5, 2.5), {
        fill: i % 2 ? GROUND.grassBlade.dark : GROUND.grassBlade.light,
        'fill-opacity': 0.12,
      }),
    );
  }
  // Blades: short strokes leaning a little, light ones catch the light from the left.
  for (let i = 0; i < 22; i++) {
    const [x, y] = pointIn(r, t.cx, t.cy, 0.88);
    const len = r.range(1.2, 2.4);
    const lean = r.range(-0.8, 0.8);
    const light = r.next() < 0.55;
    out.push(
      line([x, y], [x + lean, y - len], {
        stroke: light ? GROUND.grassBlade.light : GROUND.grassBlade.dark,
        'stroke-width': 0.6,
        'stroke-opacity': r.range(0.45, 0.85),
        'stroke-linecap': 'round',
      }),
    );
  }
  return group({}, out);
}

function dirt(t: TileCtx, colour: Hex, seed: string, edge = true): string {
  const r = rng(seed);
  const out = [base(t, colour)];
  for (let i = 0; i < 14; i++) {
    const [x, y] = pointIn(r, t.cx, t.cy, 0.85);
    out.push(
      ellipse(x, y, r.range(0.4, 0.9), r.range(0.25, 0.5), {
        fill: r.next() < 0.5 ? shade(colour, 0.7) : shade(colour, 1.2),
        'fill-opacity': 0.6,
      }),
    );
  }
  // Pebbles: shadow to the right, lit upper-left.
  for (let i = 0; i < 5; i++) {
    const [x, y] = pointIn(r, t.cx, t.cy, 0.72);
    const rx = r.range(0.8, 1.6);
    const ry = rx * r.range(0.5, 0.7);
    const tone = mix(GROUND.pebble, colour, r.range(0, 0.35));
    out.push(
      ellipse(x + 0.6, y + 0.4, rx, ry, {
        fill: '#000000',
        'fill-opacity': 0.25,
      }),
      ellipse(x, y, rx, ry, { fill: shade(tone, 0.85) }),
      ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.55, ry * 0.45, {
        fill: shade(tone, 1.25),
      }),
    );
  }
  if (edge)
    out.push(
      polygon(diamond(t.cx, t.cy, HALF_W - 0.6, HALF_H - 0.3), {
        fill: 'none',
        stroke: GROUND.dirtEdge,
        'stroke-width': 1.2,
        'stroke-opacity': 0.45,
      }),
    );
  return group({}, out);
}

function boulder(t: TileCtx): string {
  const { cx, cy, defs } = t;
  const P = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [cx + x, cy + y]);
  const outline = P([
    [-9, 1],
    [-8.5, -3.5],
    [-5, -8],
    [1, -9.5],
    [6.5, -7],
    [9, -2],
    [8, 2.5],
    [2, 4.5],
    [-5, 4],
  ]);
  const top = P([
    [-7, -4],
    [-4.5, -7.5],
    [1, -8.8],
    [5.5, -6.5],
    [2, -3.5],
    [-3, -2.8],
  ]);
  const right = P([
    [2, -3.5],
    [5.5, -6.5],
    [6.5, -7],
    [9, -2],
    [8, 2.5],
    [2, 4.5],
    [0.5, 0],
  ]);
  const rock = GROUND.rock;
  return group(
    {},
    ellipse(cx + 4, cy + 2.5, 11, 3.5, {
      fill: '#000000',
      'fill-opacity': 0.3,
      filter: defs.blur(1.2),
    }),
    polygon(outline, { fill: rock }),
    polygon(right, { fill: shade(rock, 0.62) }),
    polygon(top, { fill: shade(rock, 1.28) }),
    path(
      pathD(
        P([
          [-3, -2.8],
          [-1, 1],
          [0.5, 0],
        ]),
        false,
      ),
      {
        fill: 'none',
        stroke: shade(rock, 0.45),
        'stroke-width': 0.5,
        'stroke-opacity': 0.7,
      },
    ),
    polygon(outline, {
      fill: 'none',
      stroke: shade(rock, 0.3),
      'stroke-width': 0.7,
      'stroke-opacity': 0.8,
      'stroke-linejoin': 'round',
    }),
  );
}

/** Rune circle: blurred glow under a crisp double ring with tick runes. */
function runeCircle(t: TileCtx, colour: Hex, portal: boolean): string {
  const { cx, cy, defs } = t;
  const out: string[] = [];
  if (portal) {
    out.push(
      ellipse(cx, cy, 11.5, 5.75, {
        fill: defs.radial([
          [0, '#1a0000', 0.95],
          [0.6, shade(colour, 0.4), 0.8],
          [1, colour, 0.15],
        ]),
      }),
    );
  }
  out.push(
    ellipse(cx, cy, 12, 6, {
      fill: 'none',
      stroke: colour,
      'stroke-width': 2.4,
      'stroke-opacity': 0.75,
      filter: defs.blur(1.2),
    }),
    ellipse(cx, cy, 12, 6, {
      fill: 'none',
      stroke: mix(colour, '#ffffff', 0.4),
      'stroke-width': 0.8,
    }),
    ellipse(cx, cy, 8, 4, {
      fill: 'none',
      stroke: colour,
      'stroke-width': 0.6,
      'stroke-opacity': 0.9,
    }),
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x0 = cx + Math.cos(a) * 8.8;
    const y0 = cy + Math.sin(a) * 4.4;
    const x1 = cx + Math.cos(a) * 11.2;
    const y1 = cy + Math.sin(a) * 5.6;
    out.push(
      line([x0, y0], [x1 + (i % 2 ? 0.8 : -0.8), y1], {
        stroke: mix(colour, '#ffffff', 0.3),
        'stroke-width': 0.6,
      }),
    );
  }
  if (!portal)
    out.push(
      polygon(diamond(cx, cy, 2.4, 1.2), { fill: mix(colour, '#ffffff', 0.5) }),
      ellipse(cx, cy, 4, 2, {
        fill: colour,
        'fill-opacity': 0.5,
        filter: defs.blur(1),
      }),
    );
  return group({}, out);
}

export function generateGround(kind: GroundKind): Sprite {
  const defs = new Defs();
  const tall = kind === 'rock';
  const extraTop = tall ? 8 : 0;
  const width = TILE_CANVAS_W;
  const height = TILE_CANVAS_H + extraTop;
  const t: TileCtx = { defs, cx: width / 2, cy: OVERHANG + HALF_H + extraTop };
  let body: string;
  switch (kind) {
    case 'grass-a':
      body = grass(t, GROUND.grass[0], kind);
      break;
    case 'grass-b':
      body = grass(t, GROUND.grass[1], kind);
      break;
    case 'path-a':
      body = dirt(t, GROUND.dirt[0], kind);
      break;
    case 'path-b':
      body = dirt(t, GROUND.dirt[1], kind);
      break;
    case 'rock':
      body = group({}, grass(t, GROUND.grass[0], kind), boulder(t));
      break;
    case 'spawn':
      body = group(
        {},
        dirt(t, GROUND.dirt[0], kind, false),
        runeCircle(t, GROUND.rune.spawn, false),
      );
      break;
    case 'exit':
      body = group(
        {},
        dirt(t, GROUND.dirt[1], kind, false),
        runeCircle(t, GROUND.rune.exit, true),
      );
      break;
    case 'flash':
      body = polygon(diamond(t.cx, t.cy, HALF_W, HALF_H), { fill: '#ffffff' });
      break;
  }
  return {
    svg: svgDoc(width, height, body, defs),
    width,
    height,
    pivot: { x: t.cx, y: t.cy },
  };
}

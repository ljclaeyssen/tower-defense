/**
 * Ornament and construction primitives shared by the faction kits (organic trunks, foliage, logs,
 * stakes, spikes, skulls, bones, hides, braziers, gothic arches, railings, gears, rivets, pipes,
 * domes, smoke, wisps, ice shards). Screen-space helpers take points in sprite px; world helpers
 * take a `TowerCanvas` and cell/px coordinates. Light always comes from the left.
 */
import {
  CIRCLE_RX,
  CIRCLE_RY,
  groundEllipse,
  project,
  ringHalves,
} from '../../iso.js';
import type { FacePattern } from '../../iso.js';
import { mix, shade } from '../../palette.js';
import type { Hex } from '../../palette.js';
import { rng } from '../../random.js';
import {
  circle,
  ellipse,
  group,
  line,
  num,
  path,
  pathD,
  polygon,
  polyline,
  rect,
} from '../../svg.js';
import type { Attrs, Pt } from '../../svg.js';
import type { TowerCanvas } from './parts.js';

/** World point (cells, cells, px). */
export type P3 = readonly [number, number, number];

export const at = (c: TowerCanvas, p: P3): Pt => project(c.o, p[0], p[1], p[2]);

const d = (points: readonly Pt[]): string => pathD(points, false);
const lerp = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** Horizontal light → shadow gradient for round things (objectBoundingBox). */
export function roundFill(c: TowerCanvas, colour: Hex): string {
  return c.defs.linear([
    [0, shade(colour, 1.08)],
    [0.3, shade(colour, 1.25)],
    [0.62, colour],
    [1, shade(colour, 0.55)],
  ]);
}

/** Radial fill lit from the upper left (spheres, blobs, domes). */
export function ballFill(c: TowerCanvas, colour: Hex, light = 1.5): string {
  return c.defs.radial(
    [
      [0, shade(colour, light)],
      [0.5, colour],
      [1, shade(colour, 0.5)],
    ],
    { cx: 0.35, cy: 0.3, r: 0.75 },
  );
}

// Organic -------------------------------------------------------------------------------------

export interface TrunkSpec {
  readonly x?: number;
  readonly y?: number;
  readonly z: number;
  readonly height: number;
  /** Half widths in px at the bottom and the top. */
  readonly base: number;
  readonly top: number;
  /** Sideways sway in px and number of half-waves over the height. */
  readonly sway?: number;
  readonly waves?: number;
  readonly colour: Hex;
  /** Spiral grooves wrapping around the trunk, and how many turns they make. */
  readonly grooves?: number;
  readonly turns?: number;
  /** Extra width at the very bottom (root flare), as a ratio of `base`. */
  readonly flare?: number;
}

/** Tapered, swaying organic column (tree trunk, totem, bone shaft) with optional spiral grooves. */
export function trunk(c: TowerCanvas, s: TrunkSpec): string {
  const [bx, by] = at(c, [s.x ?? 0, s.y ?? 0, s.z]);
  const n = 18;
  const cx = (t: number): number =>
    bx + (s.sway ?? 0) * Math.sin(t * Math.PI * (s.waves ?? 1));
  const r = (t: number): number =>
    s.base + (s.top - s.base) * t + s.base * (s.flare ?? 0.5) * (1 - t) ** 5;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = by - t * s.height;
    left.push([cx(t) - r(t), y]);
    right.push([cx(t) + r(t), y]);
  }
  const outline = [...left, ...right.reverse()];
  const out: string[] = [
    path(pathD(outline), { fill: roundFill(c, s.colour) }),
  ];
  const grooves = s.grooves ?? 0;
  for (let k = 0; k < grooves; k++) {
    let seg: Pt[] = [];
    const flush = (): void => {
      if (seg.length > 1)
        out.push(
          polyline(seg, {
            stroke: shade(s.colour, 0.5),
            'stroke-width': 0.6,
            'stroke-opacity': 0.75,
          }),
        );
      seg = [];
    };
    for (let i = 0; i <= n * 2; i++) {
      const t = i / (n * 2);
      const phase = 2 * Math.PI * (k / grooves + t * (s.turns ?? 1));
      if (Math.cos(phase) <= 0) {
        flush();
        continue;
      }
      seg.push([
        cx(t) + r(t) * Math.sin(phase) * 0.92,
        by - t * s.height + Math.cos(phase) * 0.6,
      ]);
    }
    flush();
  }
  out.push(
    path(pathD(outline), {
      fill: 'none',
      stroke: shade(s.colour, 0.35),
      'stroke-width': 0.6,
      'stroke-opacity': 0.7,
    }),
  );
  return group({}, out);
}

/** Roots spreading on the ground around (x, y), drawn before the trunk. */
export function roots(
  c: TowerCanvas,
  x: number,
  y: number,
  count: number,
  length: number,
  colour: Hex,
  seed: string,
): string {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r.range(-0.3, 0.3);
    const len = length * r.range(0.7, 1.1);
    const base = at(c, [x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.12, 1.5]);
    const mid = at(c, [
      x + Math.cos(a + 0.3) * len * 0.55,
      y + Math.sin(a + 0.3) * len * 0.55,
      0.8,
    ]);
    const tip = at(c, [x + Math.cos(a) * len, y + Math.sin(a) * len, 0]);
    const dd = `M${num(base[0])} ${num(base[1])} Q${num(mid[0])} ${num(mid[1])} ${num(tip[0])} ${num(tip[1])}`;
    out.push(
      path(dd, {
        fill: 'none',
        stroke: shade(colour, 0.45),
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
      path(dd, {
        fill: 'none',
        stroke:
          Math.cos(a) - Math.sin(a) < 0
            ? shade(colour, 1.1)
            : shade(colour, 0.75),
        'stroke-width': 1.8,
        'stroke-linecap': 'round',
      }),
    );
  }
  return group({}, out);
}

export interface CanopySpec {
  readonly at: Pt;
  readonly rx: number;
  readonly ry: number;
  readonly colour: Hex;
  readonly seed: string;
  /** Leaf clumps around the rim. */
  readonly clumps?: number;
}

/** Layered foliage disc: dark underside, lit body, leaf clumps lit on the left. */
export function canopy(c: TowerCanvas, s: CanopySpec): string {
  const [x, y] = s.at;
  const r = rng(s.seed);
  const out: string[] = [
    ellipse(x + 1, y + s.ry * 0.45, s.rx * 0.96, s.ry * 0.85, {
      fill: shade(s.colour, 0.42),
    }),
    ellipse(x, y, s.rx, s.ry, { fill: ballFill(c, s.colour, 1.35) }),
  ];
  const clumps = s.clumps ?? 9;
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + r.range(-0.2, 0.2);
    const cx = x + Math.cos(a) * s.rx * 0.82;
    const cy = y + Math.sin(a) * s.ry * 0.7;
    const size = s.rx * r.range(0.2, 0.3);
    const lit = Math.cos(a) < 0.2 && Math.sin(a) < 0.5;
    out.push(
      ellipse(cx, cy, size, size * 0.62, {
        fill: lit
          ? shade(s.colour, 1.3)
          : Math.sin(a) > 0.3
            ? shade(s.colour, 0.72)
            : s.colour,
      }),
    );
  }
  for (let i = 0; i < 6; i++) {
    const px = x + r.range(-0.6, 0.4) * s.rx;
    const py = y + r.range(-0.6, 0.2) * s.ry;
    out.push(
      ellipse(px, py, 1, 0.55, {
        fill: shade(s.colour, 1.55),
        'fill-opacity': 0.8,
      }),
    );
  }
  return group({}, out);
}

/** Almond leaf centred at `p`, rotated `deg`. */
export function leaf(p: Pt, length: number, deg: number, colour: Hex): string {
  const [x, y] = p;
  const h = length / 2;
  const w = length * 0.28;
  return group(
    { transform: `rotate(${num(deg)} ${num(x)} ${num(y)})` },
    path(
      `M${num(x - h)} ${num(y)} Q${num(x)} ${num(y - w * 2)} ${num(x + h)} ${num(y)} Q${num(x)} ${num(y + w * 2)} ${num(x - h)} ${num(y)} Z`,
      {
        fill: colour,
        stroke: shade(colour, 0.5),
        'stroke-width': 0.35,
      },
    ),
    line([x - h * 0.8, y], [x + h * 0.8, y], {
      stroke: shade(colour, 1.35),
      'stroke-width': 0.3,
    }),
  );
}

/** Crescent moon of radius r centred at (x, y), horns pointing right before `deg` rotation. */
export function crescent(p: Pt, r: number, deg: number, attrs: Attrs): string {
  const r2 = r * 0.82;
  const dd = r * 0.48;
  const ix = (dd * dd + r * r - r2 * r2) / (2 * dd);
  const iy = Math.sqrt(Math.max(0, r * r - ix * ix));
  const [x, y] = p;
  return path(
    `M${num(x + ix)} ${num(y - iy)} A${num(r)} ${num(r)} 0 1 0 ${num(x + ix)} ${num(y + iy)} A${num(r2)} ${num(r2)} 0 0 1 ${num(x + ix)} ${num(y - iy)} Z`,
    { transform: `rotate(${num(deg)} ${num(x)} ${num(y)})`, ...attrs },
  );
}

/** Lantern hanging `len` px below `from`, with a warm glow. */
export function lantern(
  c: TowerCanvas,
  from: Pt,
  len: number,
  light: Hex,
  frame: Hex,
): string {
  const [x, y] = from;
  const ly = y + len;
  return group(
    {},
    line([x, y], [x, ly - 1.6], {
      stroke: shade(frame, 0.6),
      'stroke-width': 0.4,
    }),
    circle(x, ly + 0.4, 3.2, {
      fill: light,
      'fill-opacity': 0.5,
      filter: c.defs.blur(1.3),
    }),
    rect(x - 1.2, ly - 1.6, 2.4, 3.4, {
      rx: 0.9,
      fill: light,
      stroke: frame,
      'stroke-width': 0.45,
    }),
    line([x - 1.4, ly - 1.6], [x + 1.4, ly - 1.6], {
      stroke: frame,
      'stroke-width': 0.6,
    }),
  );
}

/** Little flowers scattered around (x, y) on the ground. */
export function flowers(
  c: TowerCanvas,
  x: number,
  y: number,
  radius: number,
  count: number,
  colours: readonly Hex[],
  seed: string,
): string {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = r.range(-0.4, Math.PI + 0.4) + Math.PI / 4;
    const dist = radius * r.range(0.7, 1);
    const p = at(c, [x + Math.cos(a) * dist, y + Math.sin(a) * dist, 0.5]);
    const colour = colours[i % colours.length] ?? '#ffffff';
    out.push(
      circle(p[0], p[1], 0.9, { fill: colour }),
      circle(p[0], p[1], 0.35, { fill: '#ffe46a' }),
    );
  }
  return group({}, out);
}

/** Thick horizontal ring around a vertical axis, split for occlusion. */
export function isoRing(
  c: TowerCanvas,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number,
  colour: Hex,
): { back: string; front: string } {
  const h = ringHalves(groundEllipse(c.o, x, y, z, radius));
  return {
    back: path(h.back, {
      fill: 'none',
      stroke: shade(colour, 0.6),
      'stroke-width': width,
      'stroke-linecap': 'round',
    }),
    front: group(
      {},
      path(h.front, {
        fill: 'none',
        stroke: shade(colour, 0.4),
        'stroke-width': width + 0.7,
        'stroke-linecap': 'round',
      }),
      path(h.front, {
        fill: 'none',
        stroke: colour,
        'stroke-width': width,
        'stroke-linecap': 'round',
      }),
      path(h.front, {
        fill: 'none',
        stroke: shade(colour, 1.3),
        'stroke-width': width * 0.3,
        transform: `translate(0 ${num(-width * 0.25)})`,
      }),
    ),
  };
}

// Wood, stakes, beams ----------------------------------------------------------------------------

/** Stacked horizontal logs on a face: highlights, shadows, grain and round end grain at the corners. */
export function logs(
  row: number,
  endColour: Hex,
  ends: 'start' | 'end' | 'both',
): FacePattern {
  return (w, h) => {
    const out: string[] = [];
    const rows = Math.max(1, Math.round(h / row));
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * rh;
      out.push(
        rect(0, y + rh * 0.12, w, rh * 0.22, {
          fill: '#ffffff',
          'fill-opacity': 0.16,
        }),
        rect(0, y + rh * 0.7, w, rh * 0.3, {
          fill: '#000000',
          'fill-opacity': 0.22,
        }),
        line([0, y + rh], [w, y + rh], {
          stroke: '#000000',
          'stroke-opacity': 0.45,
          'stroke-width': 0.5,
        }),
      );
      const ends2 = ends === 'both' ? [0, w] : ends === 'start' ? [0] : [w];
      for (const u of ends2)
        out.push(
          ellipse(u, y + rh / 2, rh * 0.45, rh * 0.48, {
            fill: endColour,
            stroke: shade(endColour, 0.5),
            'stroke-width': 0.35,
          }),
          ellipse(u, y + rh / 2, rh * 0.18, rh * 0.2, {
            fill: 'none',
            stroke: shade(endColour, 0.6),
            'stroke-width': 0.3,
          }),
        );
    }
    return group({}, out);
  };
}

/** Round beam (log, pole, bone shaft) between two screen points. */
export function beam(a: Pt, b: Pt, width: number, colour: Hex): string {
  return group(
    {},
    line(a, b, {
      stroke: shade(colour, 0.4),
      'stroke-width': width + 0.8,
      'stroke-linecap': 'round',
    }),
    line(a, b, {
      stroke: colour,
      'stroke-width': width,
      'stroke-linecap': 'round',
    }),
    line(
      [a[0] - width * 0.22, a[1] - width * 0.1],
      [b[0] - width * 0.22, b[1] - width * 0.1],
      {
        stroke: shade(colour, 1.35),
        'stroke-width': width * 0.3,
        'stroke-linecap': 'round',
      },
    ),
  );
}

/** Log end grain disc. */
export function logEnd(p: Pt, r: number, colour: Hex): string {
  return group(
    {},
    circle(p[0], p[1], r, {
      fill: colour,
      stroke: shade(colour, 0.45),
      'stroke-width': 0.4,
    }),
    circle(p[0], p[1], r * 0.45, {
      fill: 'none',
      stroke: shade(colour, 0.6),
      'stroke-width': 0.3,
    }),
  );
}

/** Sharpened stakes standing between two ground points (cells) from z, back to front. */
export function stakes(
  c: TowerCanvas,
  from: readonly [number, number],
  to: readonly [number, number],
  z: number,
  height: number,
  count: number,
  colour: Hex,
  seed: string,
): string {
  const r = rng(seed);
  const items: { depth: number; svg: string }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const h = height * r.range(0.8, 1.15);
    const [px, py] = at(c, [x, y, z]);
    const w = 1.5;
    items.push({
      depth: x + y,
      svg: group(
        {},
        polygon(
          [
            [px - w, py],
            [px - w, py - h],
            [px, py - h - 2.6],
            [px, py],
          ],
          { fill: shade(colour, 1.1) },
        ),
        polygon(
          [
            [px, py],
            [px, py - h - 2.6],
            [px + w, py - h],
            [px + w, py],
          ],
          { fill: shade(colour, 0.6) },
        ),
        path(
          d([
            [px - w, py],
            [px - w, py - h],
            [px, py - h - 2.6],
            [px + w, py - h],
            [px + w, py],
          ]),
          {
            fill: 'none',
            stroke: shade(colour, 0.3),
            'stroke-width': 0.4,
          },
        ),
      ),
    });
  }
  return items
    .sort((a, b) => a.depth - b.depth)
    .map((i) => i.svg)
    .join('');
}

/** Spike/horn: triangle from a base centre, lit half on the left. `deg` 0 = straight up. */
export function spike(
  base: Pt,
  length: number,
  width: number,
  deg: number,
  colour: Hex,
): string {
  const [x, y] = base;
  const w = width / 2;
  return group(
    { transform: `rotate(${num(deg)} ${num(x)} ${num(y)})` },
    polygon(
      [
        [x - w, y],
        [x, y - length],
        [x, y],
      ],
      { fill: shade(colour, 1.15) },
    ),
    polygon(
      [
        [x, y],
        [x, y - length],
        [x + w, y],
      ],
      { fill: shade(colour, 0.6) },
    ),
    polygon(
      [
        [x - w, y],
        [x, y - length],
        [x + w, y],
      ],
      { fill: 'none', stroke: shade(colour, 0.3), 'stroke-width': 0.35 },
    ),
  );
}

/** Curved tusk/horn from `base`, curling toward `side` (−1 left, 1 right). */
export function tusk(
  base: Pt,
  length: number,
  side: -1 | 1,
  colour: Hex,
): string {
  const [x, y] = base;
  const tip: Pt = [x + side * length * 0.55, y - length];
  const ctl: Pt = [x + side * length * 0.05, y - length * 0.8];
  return path(
    `M${num(x - 1.1)} ${num(y)} Q${num(ctl[0] - 1)} ${num(ctl[1])} ${num(tip[0])} ${num(tip[1])} Q${num(ctl[0] + 1)} ${num(ctl[1] + 0.8)} ${num(x + 1.1)} ${num(y)} Z`,
    { fill: colour, stroke: shade(colour, 0.45), 'stroke-width': 0.4 },
  );
}

// Bone & death --------------------------------------------------------------------------------

/** Skull at `p` (centre of the cranium), `s` = scale (1 ≈ 5 px wide). */
export function skull(p: Pt, s: number, colour: Hex): string {
  const [x, y] = p;
  return group(
    {},
    rect(x - 1.4 * s, y + 0.6 * s, 2.8 * s, 1.8 * s, {
      rx: 0.5 * s,
      fill: shade(colour, 0.85),
      stroke: shade(colour, 0.4),
      'stroke-width': 0.35,
    }),
    circle(x, y, 2.3 * s, {
      fill: colour,
      stroke: shade(colour, 0.4),
      'stroke-width': 0.35,
    }),
    path(
      `M${num(x + 0.4 * s)} ${num(y - 2.2 * s)} A${num(2.3 * s)} ${num(2.3 * s)} 0 0 1 ${num(x + 0.4 * s)} ${num(y + 2.2 * s)} Z`,
      {
        fill: '#000000',
        'fill-opacity': 0.2,
      },
    ),
    circle(x - 0.9 * s, y + 0.4 * s, 0.7 * s, { fill: '#1a1416' }),
    circle(x + 0.9 * s, y + 0.4 * s, 0.7 * s, { fill: '#1a1416' }),
    polygon(
      [
        [x, y + 1.1 * s],
        [x - 0.35 * s, y + 1.7 * s],
        [x + 0.35 * s, y + 1.7 * s],
      ],
      { fill: '#1a1416' },
    ),
  );
}

/** Bone between two points, with knobbly ends. */
export function bone(a: Pt, b: Pt, width: number, colour: Hex): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width * 0.45;
  const ny = (dx / len) * width * 0.45;
  const knobs = [a, b].flatMap((p) => [
    circle(p[0] + nx, p[1] + ny, width * 0.6, {
      fill: colour,
      stroke: shade(colour, 0.45),
      'stroke-width': 0.3,
    }),
    circle(p[0] - nx, p[1] - ny, width * 0.6, {
      fill: colour,
      stroke: shade(colour, 0.45),
      'stroke-width': 0.3,
    }),
  ]);
  return group(
    {},
    line(a, b, {
      stroke: shade(colour, 0.45),
      'stroke-width': width + 0.6,
      'stroke-linecap': 'round',
    }),
    knobs,
    line(a, b, {
      stroke: colour,
      'stroke-width': width,
      'stroke-linecap': 'round',
    }),
    line(lerp(a, b, 0.15), lerp(a, b, 0.85), {
      stroke: shade(colour, 0.7),
      'stroke-width': width * 0.35,
      transform: `translate(${num(width * 0.2)} ${num(width * 0.2)})`,
    }),
  );
}

/** Small tilted gravestone standing at a ground point. */
export function gravestone(
  c: TowerCanvas,
  p: P3,
  w: number,
  h: number,
  tilt: number,
  colour: Hex,
): string {
  const [x, y] = at(c, p);
  const top = y - h;
  const body = `M${num(x - w / 2)} ${num(y)} L${num(x - w / 2)} ${num(top + w / 2)} A${num(w / 2)} ${num(w / 2)} 0 0 1 ${num(x + w / 2)} ${num(top + w / 2)} L${num(x + w / 2)} ${num(y)} Z`;
  return group(
    { transform: `rotate(${num(tilt)} ${num(x)} ${num(y)})` },
    path(body, { fill: shade(colour, 0.55), transform: 'translate(1.2 -0.5)' }),
    path(body, {
      fill: colour,
      stroke: shade(colour, 0.35),
      'stroke-width': 0.4,
    }),
    line([x, top + w * 0.45], [x, top + w * 0.45 + h * 0.4], {
      stroke: shade(colour, 0.5),
      'stroke-width': 0.5,
    }),
    line([x - w * 0.22, top + w * 0.65], [x + w * 0.22, top + w * 0.65], {
      stroke: shade(colour, 0.5),
      'stroke-width': 0.5,
    }),
  );
}

/** Ghostly wisp with a curling tail and two dark eyes. */
export function wisp(
  c: TowerCanvas,
  p: Pt,
  size: number,
  colour: Hex,
  tail: -1 | 1,
): string {
  const [x, y] = p;
  const s = size;
  const body = `M${num(x - s)} ${num(y)} A${num(s)} ${num(s)} 0 0 1 ${num(x + s)} ${num(y)} Q${num(x + s * 0.8)} ${num(y + s * 1.6)} ${num(x + tail * s * 1.4)} ${num(y + s * 2.4)} Q${num(x - s * 0.2)} ${num(y + s * 1.4)} ${num(x - s)} ${num(y)} Z`;
  return group(
    {},
    circle(x, y + s * 0.5, s * 2, {
      fill: colour,
      'fill-opacity': 0.4,
      filter: c.defs.blur(s * 0.7),
    }),
    path(body, {
      fill: c.defs.radial(
        [
          [0, '#ffffff'],
          [0.6, colour, 0.9],
          [1, colour, 0.3],
        ],
        { cx: 0.4, cy: 0.25, r: 0.8 },
      ),
    }),
    circle(x - s * 0.35, y - s * 0.05, s * 0.2, { fill: '#10201a' }),
    circle(x + s * 0.35, y - s * 0.05, s * 0.2, { fill: '#10201a' }),
  );
}

// Fire, smoke, ice ----------------------------------------------------------------------------

/** Teardrop flame standing on (x, y). */
export function flame(
  x: number,
  y: number,
  w: number,
  h: number,
  colour: Hex,
): string {
  return path(
    `M${num(x)} ${num(y)} Q${num(x - w)} ${num(y - h * 0.35)} ${num(x)} ${num(y - h)} Q${num(x + w)} ${num(y - h * 0.35)} ${num(x)} ${num(y)} Z`,
    { fill: colour },
  );
}

/** Iron bowl on a short stand with flames, glow and embers. */
export function brazier(
  c: TowerCanvas,
  p: Pt,
  size: number,
  fire: Hex,
  iron: Hex,
): string {
  const [x, y] = p;
  const s = size;
  return group(
    {},
    line([x - s * 0.6, y + s * 1.4], [x - s * 0.2, y + s * 0.5], {
      stroke: iron,
      'stroke-width': 0.7,
    }),
    line([x + s * 0.6, y + s * 1.4], [x + s * 0.2, y + s * 0.5], {
      stroke: shade(iron, 0.7),
      'stroke-width': 0.7,
    }),
    circle(x, y - s * 0.8, s * 2.2, {
      fill: fire,
      'fill-opacity': 0.45,
      filter: c.defs.blur(s * 0.9),
    }),
    flame(x - s * 0.35, y, s * 0.55, s * 1.8, shade(fire, 0.85)),
    flame(x + s * 0.3, y, s * 0.5, s * 1.5, shade(fire, 0.85)),
    flame(x, y, s * 0.55, s * 2.3, fire),
    flame(x, y, s * 0.28, s * 1.3, mix(fire, '#ffffff', 0.6)),
    path(
      `M${num(x - s)} ${num(y - s * 0.1)} Q${num(x)} ${num(y + s * 1.1)} ${num(x + s)} ${num(y - s * 0.1)} Z`,
      { fill: roundFill(c, iron) },
    ),
    ellipse(x, y - s * 0.1, s, s * 0.32, {
      fill: shade(iron, 0.6),
      stroke: shade(iron, 1.3),
      'stroke-width': 0.35,
    }),
    circle(x - s * 0.5, y - s * 2.6, 0.45, { fill: mix(fire, '#ffffff', 0.4) }),
    circle(x + s * 0.7, y - s * 3.1, 0.35, { fill: fire }),
  );
}

/** Puffs of smoke rising and drifting right from `p`. */
export function smoke(
  c: TowerCanvas,
  p: Pt,
  puffs: number,
  colour: Hex,
): string {
  const out: string[] = [];
  for (let i = 0; i < puffs; i++) {
    const t = i / Math.max(1, puffs - 1);
    out.push(
      circle(p[0] + t * 5 + (i % 2) * 1.2, p[1] - 2 - t * 9, 1.6 + t * 1.6, {
        fill: shade(colour, 1.15 - t * 0.1),
        'fill-opacity': 0.85 - t * 0.45,
        filter: c.defs.blur(0.35),
      }),
    );
  }
  return group({}, out);
}

export interface ShardSpec {
  /** Ground offset (cells). */
  readonly x: number;
  readonly y: number;
  readonly height: number;
  /** Half width in px. */
  readonly width: number;
  /** Horizontal tip offset per px of height. */
  readonly lean: number;
}

/** Faceted ice crystal standing at z: lit left facet, shaded right facet, white lit edge. */
export function iceShard(
  c: TowerCanvas,
  s: ShardSpec,
  z: number,
  ice: Hex,
): string {
  const [bx, by] = at(c, [s.x, s.y, z]);
  const w = s.width;
  const h = s.height;
  const shoulder = 0.74;
  const lean = (t: number): number => s.lean * h * t;
  const L: Pt = [bx - w, by - w * 0.25];
  const F: Pt = [bx + w * 0.15, by + w * 0.35];
  const R: Pt = [bx + w, by - w * 0.25];
  const up = (p: Pt): Pt => [
    p[0] * 0.92 + bx * 0.08 + lean(shoulder),
    p[1] - h * shoulder,
  ];
  const Ls = up(L);
  const Fs = up(F);
  const Rs = up(R);
  const T: Pt = [bx + lean(1) + w * 0.1, by - h];
  return group(
    {},
    polygon([L, Ls, T, Fs, F], {
      fill: shade(ice, 1.05),
      'fill-opacity': 0.95,
    }),
    polygon([F, Fs, T, Rs, R], {
      fill: shade(ice, 0.66),
      'fill-opacity': 0.95,
    }),
    polygon([Ls, T, Fs], { fill: shade(ice, 1.3), 'fill-opacity': 0.9 }),
    path(pathD([L, Ls, T, Rs, R, F], true), {
      fill: 'none',
      stroke: shade(ice, 0.35),
      'stroke-width': 0.5,
      'stroke-opacity': 0.8,
    }),
    line(L, Ls, {
      stroke: '#ffffff',
      'stroke-width': 0.6,
      'stroke-opacity': 0.9,
    }),
    line(F, Fs, {
      stroke: '#ffffff',
      'stroke-width': 0.4,
      'stroke-opacity': 0.55,
    }),
  );
}

/** Four-point sparkle. */
export function sparkle(p: Pt, r: number, colour: Hex): string {
  const [x, y] = p;
  const k = r * 0.15;
  return path(
    `M${num(x)} ${num(y - r)} Q${num(x + k)} ${num(y - k)} ${num(x + r)} ${num(y)} Q${num(x + k)} ${num(y + k)} ${num(x)} ${num(y + r)} Q${num(x - k)} ${num(y + k)} ${num(x - r)} ${num(y)} Q${num(x - k)} ${num(y - k)} ${num(x)} ${num(y - r)} Z`,
    { fill: colour },
  );
}

/** Jagged glowing lightning arc between two points. */
export function lightning(
  c: TowerCanvas,
  a: Pt,
  b: Pt,
  colour: Hex,
  seed: string,
  kinks = 4,
): string {
  const r = rng(seed);
  const pts: Pt[] = [a];
  for (let i = 1; i < kinks; i++) {
    const t = i / kinks;
    pts.push([
      a[0] + (b[0] - a[0]) * t + r.range(-2, 2),
      a[1] + (b[1] - a[1]) * t + r.range(-2, 2),
    ]);
  }
  pts.push(b);
  return group(
    {},
    polyline(pts, {
      stroke: colour,
      'stroke-width': 2,
      'stroke-opacity': 0.6,
      filter: c.defs.blur(0.8),
      'stroke-linejoin': 'round',
    }),
    polyline(pts, {
      stroke: '#ffffff',
      'stroke-width': 0.6,
      'stroke-linejoin': 'round',
    }),
  );
}

// Gothic & iron -------------------------------------------------------------------------------

/** Pointed (equilateral) gothic arch path in local coordinates: box (u, v, w, h). */
export function gothicArchD(
  u: number,
  v: number,
  w: number,
  h: number,
): string {
  const rise = Math.min(h, w * 0.87);
  return `M${num(u)} ${num(v + h)} L${num(u)} ${num(v + rise)} A${num(w)} ${num(w)} 0 0 1 ${num(u + w / 2)} ${num(v)} A${num(w)} ${num(w)} 0 0 1 ${num(u + w)} ${num(v + rise)} L${num(u + w)} ${num(v + h)} Z`;
}

/** Gothic window pattern for a face: stone frame, glowing interior, mullion. */
export function gothicWindow(
  u: number,
  v: number,
  w: number,
  h: number,
  glow: Hex,
  frame: Hex,
): FacePattern {
  return () =>
    group(
      {},
      path(gothicArchD(u - 1, v - 1, w + 2, h + 1), { fill: frame }),
      path(gothicArchD(u, v, w, h), { fill: glow }),
      path(gothicArchD(u + w * 0.2, v + h * 0.2, w * 0.6, h * 0.7), {
        fill: '#ffffff',
        'fill-opacity': 0.35,
      }),
      line([u + w / 2, v + w * 0.4], [u + w / 2, v + h], {
        stroke: frame,
        'stroke-width': 0.6,
      }),
    );
}

/** Wrought-iron railing with spear tips between two ground points (cells) at height z. */
export function railing(
  c: TowerCanvas,
  from: readonly [number, number],
  to: readonly [number, number],
  z: number,
  height: number,
  bars: number,
  iron: Hex,
): string {
  const a0 = at(c, [from[0], from[1], z]);
  const a1 = at(c, [to[0], to[1], z]);
  const out: string[] = [];
  for (let i = 0; i < bars; i++) {
    const p = lerp(a0, a1, bars === 1 ? 0.5 : i / (bars - 1));
    out.push(
      line(p, [p[0], p[1] - height], { stroke: iron, 'stroke-width': 0.7 }),
      polygon(
        [
          [p[0] - 0.9, p[1] - height],
          [p[0], p[1] - height - 2.2],
          [p[0] + 0.9, p[1] - height],
        ],
        { fill: iron },
      ),
    );
  }
  out.push(
    line([a0[0], a0[1] - height * 0.75], [a1[0], a1[1] - height * 0.75], {
      stroke: iron,
      'stroke-width': 0.6,
    }),
    line([a0[0], a0[1] - 0.6], [a1[0], a1[1] - 0.6], {
      stroke: iron,
      'stroke-width': 0.6,
    }),
  );
  return group({}, out);
}

// Machinery -----------------------------------------------------------------------------------

/** Cog wheel path centred on (x, y). */
export function gear(
  x: number,
  y: number,
  r: number,
  teeth: number,
  colour: Hex,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    for (const [da, rr] of [
      [0, r * 0.78],
      [step * 0.18, r],
      [step * 0.5, r],
      [step * 0.68, r * 0.78],
    ] as const)
      pts.push([x + Math.cos(a + da) * rr, y + Math.sin(a + da) * rr]);
  }
  return group(
    {},
    polygon(pts, {
      fill: colour,
      stroke: shade(colour, 0.4),
      'stroke-width': 0.4,
    }),
    circle(x, y, r * 0.55, {
      fill: shade(colour, 1.2),
      stroke: shade(colour, 0.5),
      'stroke-width': 0.35,
    }),
    circle(x, y, r * 0.2, { fill: shade(colour, 0.35) }),
  );
}

/** Row of rivets (local coordinates). */
export function rivets(
  u0: number,
  u1: number,
  v: number,
  step: number,
  colour: Hex,
): string {
  const out: string[] = [];
  for (let u = u0; u <= u1 + 1e-6; u += step)
    out.push(
      circle(u, v, 0.55, { fill: shade(colour, 0.5) }),
      circle(u - 0.15, v - 0.15, 0.32, { fill: shade(colour, 1.5) }),
    );
  return group({}, out);
}

/** Riveted iron plate pattern for a face: plate seams and rivet rows. */
export function plates(plateW: number, colour: Hex): FacePattern {
  return (w, h) => {
    const out: string[] = [];
    for (let u = plateW; u < w - 1; u += plateW)
      out.push(
        line([u, 0], [u, h], {
          stroke: '#000000',
          'stroke-opacity': 0.45,
          'stroke-width': 0.5,
        }),
        line([u + 0.6, 0], [u + 0.6, h], {
          stroke: '#ffffff',
          'stroke-opacity': 0.18,
          'stroke-width': 0.4,
        }),
      );
    out.push(
      rivets(1.5, w - 1.5, 1.4, 3, colour),
      rivets(1.5, w - 1.5, h - 1.4, 3, colour),
    );
    return group({}, out);
  };
}

/** Thick pipe along screen points, with a highlight. */
export function pipe(
  points: readonly Pt[],
  width: number,
  colour: Hex,
): string {
  const dd = d(points);
  return group(
    {},
    path(dd, {
      fill: 'none',
      stroke: shade(colour, 0.4),
      'stroke-width': width + 0.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    path(dd, {
      fill: 'none',
      stroke: colour,
      'stroke-width': width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    path(dd, {
      fill: 'none',
      stroke: shade(colour, 1.45),
      'stroke-width': width * 0.3,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      transform: `translate(${num(-width * 0.2)} ${num(-width * 0.2)})`,
    }),
  );
}

/** Half-sphere dome on a horizontal circle (radius in cells), `height` px tall. */
export function dome(
  c: TowerCanvas,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  colour: Hex,
): string {
  const [ex, ey] = at(c, [x, y, z]);
  const rx = CIRCLE_RX * radius;
  const ry = CIRCLE_RY * radius;
  const dd = `M${num(ex - rx)} ${num(ey)} A${num(rx)} ${num(height)} 0 0 1 ${num(ex + rx)} ${num(ey)} A${num(rx)} ${num(ry)} 0 0 1 ${num(ex - rx)} ${num(ey)} Z`;
  return group(
    {},
    path(dd, {
      fill: ballFill(c, colour, 1.6),
      stroke: shade(colour, 0.4),
      'stroke-width': 0.5,
    }),
    path(
      `M${num(ex - rx * 0.55)} ${num(ey - height * 0.55)} A${num(rx * 0.6)} ${num(height * 0.6)} 0 0 1 ${num(ex - rx * 0.05)} ${num(ey - height * 0.86)}`,
      {
        fill: 'none',
        stroke: '#ffffff',
        'stroke-opacity': 0.55,
        'stroke-width': 0.7,
        'stroke-linecap': 'round',
      },
    ),
  );
}

/** Round gauge with a needle. */
export function gauge(p: Pt, r: number, rim: Hex): string {
  return group(
    {},
    circle(p[0], p[1], r, {
      fill: '#f4efe0',
      stroke: rim,
      'stroke-width': 0.7,
    }),
    line(p, [p[0] + r * 0.6, p[1] - r * 0.45], {
      stroke: '#c0352a',
      'stroke-width': 0.5,
    }),
    circle(p[0], p[1], 0.35, { fill: '#333333' }),
  );
}

/** Wooden crate (iso box) with metal straps. */
export function crateLines(colour: Hex): FacePattern {
  return (w, h) =>
    group(
      {},
      rect(0.4, 0.4, w - 0.8, h - 0.8, {
        fill: 'none',
        stroke: shade(colour, 0.45),
        'stroke-width': 0.5,
      }),
      line([0.6, 0.6], [w - 0.6, h - 0.6], {
        stroke: shade(colour, 0.5),
        'stroke-width': 0.5,
      }),
    );
}

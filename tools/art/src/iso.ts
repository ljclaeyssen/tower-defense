/**
 * Isometric 2:1 helpers. World coordinates are (x, y) in grid cells and z in logical px above the
 * ground; `project` maps them to screen px relative to an origin (the anchor of the sprite):
 * screenX = (x − y)·16, screenY = (x + y)·8 − z. Light comes from the left: the +y facing face is
 * the "left" face (lit), the +x facing face the "right" face (shaded), the top is the lightest.
 */
import type { FaceColours, Hex, RoofStyle } from './palette.js';
import { mix, shade } from './palette.js';
import type { Rng } from './random.js';
import {
  Defs,
  ellipse,
  group,
  line,
  matrix,
  num,
  path,
  pathD,
  polygon,
  rect,
  skewY,
  translate,
  transforms,
} from './svg.js';
import type { Pt } from './svg.js';

export const TILE_W = 32;
export const TILE_H = 16;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
/** Angle of the iso ground axes on screen (atan 0.5). */
export const ISO_ANGLE = (Math.atan(0.5) * 180) / Math.PI;
/** Screen radii of a ground circle of radius 1 cell. */
export const CIRCLE_RX = HALF_W * Math.SQRT2;
export const CIRCLE_RY = HALF_H * Math.SQRT2;

/** Drawing context of one sprite: the anchor (world origin on screen) and its defs. */
export interface Ctx {
  readonly o: Pt;
  readonly defs: Defs;
}

export function project(o: Pt, x: number, y: number, z = 0): Pt {
  return [o[0] + (x - y) * HALF_W, o[1] + (x + y) * HALF_H - z];
}

/** Axis-aligned box: x/y in cells (relative to the anchor), z in px. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Box centred on (cx, cy) with full footprint w × d cells, from z0 up `height` px. */
export function box(
  cx: number,
  cy: number,
  w: number,
  d: number,
  z0: number,
  height: number,
): Box {
  return {
    x0: cx - w / 2,
    x1: cx + w / 2,
    y0: cy - d / 2,
    y1: cy + d / 2,
    z0,
    z1: z0 + height,
  };
}

// Face patterns -------------------------------------------------------------------------------

export type Face = 'left' | 'right' | 'top';

/**
 * Pattern drawn in face-local coordinates: u to the right, v downward, (0, 0) = top-left corner of
 * the face, size w × h px. The face transform skews it so it follows the perspective.
 */
export type FacePattern = (w: number, h: number) => string;

/**
 * Transform mapping face-local coordinates onto a box face. Left face: u along +x, skewY(+26.565°).
 * Right face: u along −y, skewY(−26.565°). Top face: u along +x, v along +y (16 px per cell).
 */
export function faceTransform(
  o: Pt,
  b: Box,
  face: Face,
): { readonly transform: string; readonly w: number; readonly h: number } {
  if (face === 'left') {
    const [px, py] = project(o, b.x0, b.y1, b.z1);
    return {
      transform: transforms(translate(px, py), skewY(ISO_ANGLE)),
      w: (b.x1 - b.x0) * HALF_W,
      h: b.z1 - b.z0,
    };
  }
  if (face === 'right') {
    const [px, py] = project(o, b.x1, b.y1, b.z1);
    return {
      transform: transforms(translate(px, py), skewY(-ISO_ANGLE)),
      w: (b.y1 - b.y0) * HALF_W,
      h: b.z1 - b.z0,
    };
  }
  const [px, py] = project(o, b.x0, b.y0, b.z1);
  return {
    transform: matrix(1, 0.5, -1, 0.5, px, py),
    w: (b.x1 - b.x0) * HALF_W,
    h: (b.y1 - b.y0) * HALF_W,
  };
}

/** Draws `pattern` on a face of `b`. */
export function onFace(
  o: Pt,
  b: Box,
  face: Face,
  pattern: FacePattern,
): string {
  const { transform, w, h } = faceTransform(o, b, face);
  return group({ transform }, pattern(w, h));
}

export interface BrickOptions {
  /** Course height in px. */
  readonly course: number;
  readonly brick: number;
  readonly mortar: Hex;
  readonly mortarOpacity?: number;
  /** Per-brick tint jitter: random light/dark overlay opacity up to this value. */
  readonly jitter?: number;
  readonly rng?: Rng;
}

/** Running-bond masonry: courses, staggered joints and slightly varied brick tints. */
export function bricks(o: BrickOptions): FacePattern {
  return (w, h) => {
    const out: string[] = [];
    const rows = Math.max(1, Math.round(h / o.course));
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * ch;
      const offset = r % 2 === 0 ? 0 : o.brick / 2;
      for (let x = -offset; x < w; x += o.brick) {
        const x0 = Math.max(0, x);
        const x1 = Math.min(w, x + o.brick);
        if (o.jitter && o.rng) {
          const t = o.rng.range(-1, 1) * o.jitter;
          out.push(
            rect(x0, y, x1 - x0, ch, {
              fill: t > 0 ? '#ffffff' : '#000000',
              'fill-opacity': Math.abs(t),
            }),
          );
        }
        if (x > 0) out.push(line([x, y], [x, y + ch], { 'stroke-width': 0.6 }));
      }
      if (r > 0) out.push(line([0, y], [w, y], { 'stroke-width': 0.7 }));
    }
    return group(
      { stroke: o.mortar, 'stroke-opacity': o.mortarOpacity ?? 0.6 },
      out,
    );
  };
}

/** Vertical planks with a darker joint every `plank` px. */
export function planks(plank: number, joint: Hex, opacity = 0.55): FacePattern {
  return (w, h) => {
    const out: string[] = [];
    for (let x = plank; x < w - 0.5; x += plank)
      out.push(line([x, 0], [x, h], { 'stroke-width': 0.6 }));
    return group({ stroke: joint, 'stroke-opacity': opacity }, out);
  };
}

/** Horizontal band (string course) across a face, from v = y to y + height. */
export function band(y: number, height: number, fill: Hex): FacePattern {
  return (w) => rect(0, y, w, height, { fill });
}

/** Combines several patterns on the same face. */
export const patterns =
  (...list: readonly FacePattern[]): FacePattern =>
  (w, h) =>
    list.map((p) => p(w, h)).join('');

// Prisms --------------------------------------------------------------------------------------

export interface PrismSpec {
  readonly cx?: number;
  readonly cy?: number;
  /** Full footprint along x and y, in cells. */
  readonly footprintW: number;
  readonly footprintD: number;
  readonly z?: number;
  readonly height: number;
  readonly palette: FaceColours;
  /** Scale of the top face relative to the base (1 = straight walls). Patterns need taper = 1. */
  readonly taper?: number;
  readonly left?: FacePattern;
  readonly right?: FacePattern;
  readonly top?: FacePattern;
  /** Opacity of the outline (0 = none). */
  readonly outline?: number;
  /** Darken the bottom of the walls (ambient occlusion). */
  readonly ao?: boolean;
}

/** Iso block with lit left face, shaded right face, light top; optional face patterns. */
export function prism(ctx: Ctx, s: PrismSpec): string {
  const { o, defs } = ctx;
  const b = box(
    s.cx ?? 0,
    s.cy ?? 0,
    s.footprintW,
    s.footprintD,
    s.z ?? 0,
    s.height,
  );
  const t = s.taper ?? 1;
  const cx = s.cx ?? 0;
  const cy = s.cy ?? 0;
  const tx = (x: number): number => cx + (x - cx) * t;
  const ty = (y: number): number => cy + (y - cy) * t;
  const P = (x: number, y: number, z: number): Pt => project(o, x, y, z);
  const topPts: Pt[] = [
    P(tx(b.x0), ty(b.y0), b.z1),
    P(tx(b.x1), ty(b.y0), b.z1),
    P(tx(b.x1), ty(b.y1), b.z1),
    P(tx(b.x0), ty(b.y1), b.z1),
  ];
  const leftPts: Pt[] = [
    P(tx(b.x0), ty(b.y1), b.z1),
    P(tx(b.x1), ty(b.y1), b.z1),
    P(b.x1, b.y1, b.z0),
    P(b.x0, b.y1, b.z0),
  ];
  const rightPts: Pt[] = [
    P(tx(b.x1), ty(b.y1), b.z1),
    P(tx(b.x1), ty(b.y0), b.z1),
    P(b.x1, b.y0, b.z0),
    P(b.x1, b.y1, b.z0),
  ];
  const ao = s.ao ?? true;
  const wall = (colour: Hex): string =>
    ao && s.height > 4
      ? defs.linear(
          [
            [0, colour],
            [0.75, colour],
            [1, shade(colour, 0.82)],
          ],
          {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 1,
          },
        )
      : colour;
  const outline = s.outline ?? 0.55;
  const out: string[] = [
    polygon(leftPts, { fill: wall(s.palette.left) }),
    polygon(rightPts, { fill: wall(s.palette.right) }),
    polygon(topPts, { fill: s.palette.top }),
  ];
  if (t === 1) {
    if (s.left) out.push(onFace(o, b, 'left', s.left));
    if (s.right) out.push(onFace(o, b, 'right', s.right));
    if (s.top) out.push(onFace(o, b, 'top', s.top));
  }
  // Light catches the top-left edges; outline the silhouette and the creases.
  const [t0, t1, t2, t3] = topPts as [Pt, Pt, Pt, Pt];
  out.push(
    path(pathD([t3, t2, t1], false), {
      fill: 'none',
      stroke: shade(s.palette.top, 1.3),
      'stroke-width': 0.6,
      'stroke-opacity': 0.7,
    }),
  );
  if (outline > 0) {
    const [l0, , l2, l3] = leftPts as [Pt, Pt, Pt, Pt];
    const [, , r2] = rightPts as [Pt, Pt, Pt, Pt];
    out.push(
      path(pathD([t0, t1, r2, l2, l3, l0], true), {
        fill: 'none',
        stroke: s.palette.edge,
        'stroke-width': 0.7,
        'stroke-opacity': outline,
        'stroke-linejoin': 'round',
      }),
      line(t2, l2, {
        stroke: s.palette.edge,
        'stroke-width': 0.5,
        'stroke-opacity': outline * 0.8,
      }),
    );
  }
  return group({}, out);
}

// Crenellations -------------------------------------------------------------------------------

export interface CrenellationSpec {
  readonly cx?: number;
  readonly cy?: number;
  /** Footprint of the wall top the merlons sit on (cells). */
  readonly footprintW: number;
  readonly footprintD: number;
  readonly z: number;
  /** Merlon side in cells and height in px. */
  readonly size: number;
  readonly height: number;
  /** Merlons per edge. */
  readonly count: number;
  readonly palette: FaceColours;
}

/**
 * Merlons around a wall top. `back` (along the far edges) must be drawn before whatever stands on
 * the top, `front` after it.
 */
export function crenellations(
  ctx: Ctx,
  s: CrenellationSpec,
): { readonly back: string; readonly front: string } {
  const cx = s.cx ?? 0;
  const cy = s.cy ?? 0;
  const hw = s.footprintW / 2 - s.size / 2;
  const hd = s.footprintD / 2 - s.size / 2;
  const cells = new Map<string, Pt>();
  for (let i = 0; i < s.count; i++) {
    const f = s.count === 1 ? 0.5 : i / (s.count - 1);
    const along = (a: number): number => -a + 2 * a * f;
    for (const p of [
      [cx + along(hw), cy - hd],
      [cx + along(hw), cy + hd],
      [cx - hw, cy + along(hd)],
      [cx + hw, cy + along(hd)],
    ] as const)
      cells.set(`${num(p[0])},${num(p[1])}`, p);
  }
  const sorted = [...cells.values()].sort(
    (a, b) => a[0] + a[1] - (b[0] + b[1]),
  );
  const merlon = (p: Pt): string =>
    prism(ctx, {
      cx: p[0],
      cy: p[1],
      footprintW: s.size,
      footprintD: s.size,
      z: s.z,
      height: s.height,
      palette: s.palette,
      outline: 0.45,
      ao: false,
    });
  const isFront = (p: Pt): boolean =>
    p[0] - cx > hw - 1e-6 || p[1] - cy > hd - 1e-6;
  return {
    back: sorted
      .filter((p) => !isFront(p))
      .map(merlon)
      .join(''),
    front: sorted.filter(isFront).map(merlon).join(''),
  };
}

// Roofs ----------------------------------------------------------------------------------------

export interface PyramidSpec {
  readonly cx?: number;
  readonly cy?: number;
  readonly footprintW: number;
  readonly footprintD: number;
  readonly z: number;
  readonly height: number;
  readonly palette: FaceColours;
  /** Shingle rows drawn as lines parallel to the eaves. */
  readonly rows?: number;
}

/** Four-sided roof; the two far faces are drawn first (visible on shallow roofs). */
export function pyramidRoof(ctx: Ctx, s: PyramidSpec): string {
  const { o } = ctx;
  const b = box(s.cx ?? 0, s.cy ?? 0, s.footprintW, s.footprintD, s.z, 0);
  const apex = project(o, s.cx ?? 0, s.cy ?? 0, s.z + s.height);
  const A = project(o, b.x0, b.y0, s.z);
  const B = project(o, b.x1, b.y0, s.z);
  const C = project(o, b.x1, b.y1, s.z);
  const D = project(o, b.x0, b.y1, s.z);
  const p = s.palette;
  const edge = { stroke: p.edge, 'stroke-width': 0.6, 'stroke-opacity': 0.6 };
  const out = [
    polygon([A, B, apex], { fill: mix(p.right, p.top, 0.45) }),
    polygon([D, A, apex], { fill: mix(p.left, p.top, 0.55) }),
    polygon([D, C, apex], { fill: p.left }),
    polygon([C, B, apex], { fill: p.right }),
  ];
  const rows = s.rows ?? 0;
  for (let r = 1; r <= rows; r++) {
    const f = r / (rows + 1);
    const lerp = (q: Pt): Pt => [
      q[0] + (apex[0] - q[0]) * f,
      q[1] + (apex[1] - q[1]) * f,
    ];
    out.push(
      path(pathD([lerp(D), lerp(C), lerp(B)], false), {
        fill: 'none',
        stroke: p.edge,
        'stroke-width': 0.5,
        'stroke-opacity': 0.35,
      }),
    );
  }
  out.push(
    path(pathD([D, C, B], false), { fill: 'none', ...edge }),
    line(C, apex, { ...edge, 'stroke-opacity': 0.4 }),
    path(pathD([D, apex, B], false), { fill: 'none', ...edge }),
  );
  return group({}, out);
}

export interface ConeSpec {
  readonly cx?: number;
  readonly cy?: number;
  /** Ground radius of the cone base, in cells. */
  readonly radius: number;
  readonly z: number;
  readonly height: number;
  readonly palette: FaceColours;
  readonly rows?: number;
}

/** Conical roof: silhouette from the apex tangents, horizontal light→shadow gradient, shingle rows. */
export function coneRoof(ctx: Ctx, s: ConeSpec): string {
  const { o, defs } = ctx;
  const [ex, ey] = project(o, s.cx ?? 0, s.cy ?? 0, s.z);
  const rx = CIRCLE_RX * s.radius;
  const ry = CIRCLE_RY * s.radius;
  const H = Math.max(s.height, ry * 1.05);
  // Tangent points from the apex: sin t = −ry / H.
  const sinT = -ry / H;
  const cosT = Math.sqrt(1 - sinT * sinT);
  const tl: Pt = [ex - rx * cosT, ey + ry * sinT];
  const tr: Pt = [ex + rx * cosT, ey + ry * sinT];
  const apex: Pt = [ex, ey - H];
  const p = s.palette;
  const fill = defs.linear([
    [0, mix(p.left, p.top, 0.25)],
    [0.3, p.top],
    [0.55, p.left],
    [1, p.right],
  ]);
  const silhouette = `M${num(apex[0])} ${num(apex[1])} L${num(tr[0])} ${num(tr[1])} A${num(rx)} ${num(ry)} 0 1 1 ${num(tl[0])} ${num(tl[1])} Z`;
  const out = [path(silhouette, { fill })];
  const rows = s.rows ?? 0;
  for (let r = 1; r <= rows; r++) {
    const f = r / (rows + 1);
    const k = 1 - f;
    const cyRow = ey - H * f;
    out.push(
      path(
        `M${num(ex - rx * k)} ${num(cyRow)} A${num(rx * k)} ${num(ry * k)} 0 0 0 ${num(ex + rx * k)} ${num(cyRow)}`,
        {
          fill: 'none',
          stroke: p.edge,
          'stroke-width': 0.5,
          'stroke-opacity': 0.35,
        },
      ),
    );
  }
  out.push(
    path(silhouette, {
      fill: 'none',
      stroke: p.edge,
      'stroke-width': 0.7,
      'stroke-opacity': 0.6,
      'stroke-linejoin': 'round',
    }),
  );
  return group({}, out);
}

export interface RoofSpec {
  readonly cx?: number;
  readonly cy?: number;
  /** Square footprint covered by the roof (cells), eaves included. */
  readonly footprint: number;
  readonly z: number;
  readonly height: number;
  readonly palette: FaceColours;
  readonly rows?: number;
}

/** Roof of the given style over a square footprint. */
export function roof(ctx: Ctx, style: RoofStyle, s: RoofSpec): string {
  if (style === 'cone')
    return coneRoof(ctx, {
      cx: s.cx,
      cy: s.cy,
      radius: (s.footprint / 2) * Math.SQRT2 * 0.92,
      z: s.z,
      height: s.height,
      palette: s.palette,
      rows: s.rows,
    });
  return pyramidRoof(ctx, {
    cx: s.cx,
    cy: s.cy,
    footprintW: s.footprint,
    footprintD: s.footprint,
    z: s.z,
    height: s.height,
    palette: s.palette,
    rows: s.rows,
  });
}

// Round shapes ---------------------------------------------------------------------------------

export interface CylinderSpec {
  readonly cx?: number;
  readonly cy?: number;
  readonly radius: number;
  readonly z: number;
  readonly height: number;
  readonly palette: FaceColours;
  /** Horizontal course lines on the body. */
  readonly rows?: number;
}

/** Upright cylinder with a horizontal light→shadow gradient and a lit top ellipse. */
export function cylinder(ctx: Ctx, s: CylinderSpec): string {
  const { o, defs } = ctx;
  const [bx, by] = project(o, s.cx ?? 0, s.cy ?? 0, s.z);
  const topY = by - s.height;
  const rx = CIRCLE_RX * s.radius;
  const ry = CIRCLE_RY * s.radius;
  const p = s.palette;
  const fill = defs.linear([
    [0, p.left],
    [0.28, mix(p.left, p.top, 0.5)],
    [0.6, p.left],
    [1, p.right],
  ]);
  const body = `M${num(bx - rx)} ${num(topY)} L${num(bx - rx)} ${num(by)} A${num(rx)} ${num(ry)} 0 0 0 ${num(bx + rx)} ${num(by)} L${num(bx + rx)} ${num(topY)} Z`;
  const out = [path(body, { fill })];
  const rows = s.rows ?? 0;
  for (let r = 1; r <= rows; r++) {
    const y = by - (s.height * r) / (rows + 1);
    out.push(
      path(
        `M${num(bx - rx)} ${num(y)} A${num(rx)} ${num(ry)} 0 0 0 ${num(bx + rx)} ${num(y)}`,
        {
          fill: 'none',
          stroke: p.edge,
          'stroke-width': 0.5,
          'stroke-opacity': 0.4,
        },
      ),
    );
  }
  out.push(
    path(body, {
      fill: 'none',
      stroke: p.edge,
      'stroke-width': 0.6,
      'stroke-opacity': 0.55,
    }),
    ellipse(bx, topY, rx, ry, {
      fill: p.top,
      stroke: p.edge,
      'stroke-width': 0.6,
      'stroke-opacity': 0.55,
    }),
  );
  return group({}, out);
}

/** Screen ellipse of a horizontal circle (radius in cells) at height z. */
export function groundEllipse(
  o: Pt,
  cx: number,
  cy: number,
  z: number,
  radius: number,
): {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
} {
  const [x, y] = project(o, cx, cy, z);
  return { x, y, rx: CIRCLE_RX * radius, ry: CIRCLE_RY * radius };
}

/** Far (upper) and near (lower) halves of a horizontal ring, for drawing around a shaft. */
export function ringHalves(e: {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}): { readonly back: string; readonly front: string } {
  const l = `${num(e.x - e.rx)} ${num(e.y)}`;
  const r = `${num(e.x + e.rx)} ${num(e.y)}`;
  const a = `${num(e.rx)} ${num(e.ry)}`;
  return { back: `M${l} A${a} 0 0 1 ${r}`, front: `M${l} A${a} 0 0 0 ${r}` };
}

// Shadows & anchors ----------------------------------------------------------------------------

export interface ShadowSpec {
  readonly cx?: number;
  readonly cy?: number;
  /** Footprint of the caster (cells). */
  readonly footprintW: number;
  readonly footprintD: number;
  readonly opacity?: number;
  readonly blur?: number;
  /** Shift toward the right of the screen (light from the left), px. */
  readonly offset?: number;
}

/** Soft drop shadow on the ground, pushed to the right (away from the light). */
export function dropShadow(ctx: Ctx, s: ShadowSpec): string {
  const { o, defs } = ctx;
  const b = box(s.cx ?? 0, s.cy ?? 0, s.footprintW, s.footprintD, 0, 0);
  const dx = s.offset ?? 4;
  const corners: Pt[] = [
    project(o, b.x0, b.y0),
    project(o, b.x1, b.y0),
    project(o, b.x1, b.y1),
    project(o, b.x0, b.y1),
  ].map(([x, y]) => [x + dx, y + dx * 0.1] as const);
  return polygon(corners, {
    fill: '#000000',
    'fill-opacity': s.opacity ?? 0.35,
    filter: defs.blur(s.blur ?? 1.6),
  });
}

/** Logical size of a 2×2 tower sprite and its anchor (footprint centre on the bottom diamond). */
export const TOWER_WIDTH = TILE_W * 2;
export const TOWER_MAX_HEIGHT = 112;
export function towerAnchor(height: number): Pt {
  return [TOWER_WIDTH / 2, height - TILE_H];
}

/**
 * Building blocks shared by the tower generators: canvas/anchor, plinth, banners, glows, slits.
 * Every tower sprite is TOWER_WIDTH wide; its anchor is the footprint centre on the ground, 16 px
 * above the bottom edge (the bottom corner of the 2×2 footprint diamond).
 */
import type { Team } from '@td/shared';
import {
  TOWER_MAX_HEIGHT,
  TOWER_WIDTH,
  bricks,
  dropShadow,
  faceTransform,
  prism,
  project,
  towerAnchor,
} from '../../iso.js';
import type { Box, Ctx, Face } from '../../iso.js';
import { KITS, TEAM_COLOURS, faces, mix, shade } from '../../palette.js';
import type { FactionKit, Hex } from '../../palette.js';
import { rng } from '../../random.js';
import {
  Defs,
  circle,
  ellipse,
  group,
  line,
  num,
  path,
  rect,
  svgDoc,
} from '../../svg.js';
import type { Child, Pt } from '../../svg.js';
import type { Sprite, TowerParams } from '../types.js';

export interface TowerCanvas extends Ctx {
  readonly height: number;
  readonly kit: FactionKit;
  readonly team: Team;
  readonly level: number;
  /** Seed prefix for deterministic details. */
  readonly seed: string;
}

export const PLINTH = 1.74;

export function towerCanvas(
  role: string,
  params: TowerParams,
  height: number,
): TowerCanvas {
  if (height > TOWER_MAX_HEIGHT)
    throw new Error(
      `Tower ${role} is ${height} px tall (max ${TOWER_MAX_HEIGHT})`,
    );
  return {
    o: towerAnchor(height),
    defs: new Defs(),
    height,
    kit: KITS[params.faction],
    team: params.team,
    level: params.level,
    seed: `${role}/${params.faction}/${params.level}`,
  };
}

export function finishTower(c: TowerCanvas, ...body: Child[]): Sprite {
  return {
    svg: svgDoc(TOWER_WIDTH, c.height, body, c.defs),
    width: TOWER_WIDTH,
    height: c.height,
    pivot: { x: c.o[0], y: c.o[1] },
  };
}

/** Masonry pattern of the faction, seeded per face. */
export function masonry(
  c: TowerCanvas,
  key: string,
  course = 4,
  brick = 7,
): ReturnType<typeof bricks> {
  return bricks({
    course,
    brick,
    mortar: c.kit.mortar,
    mortarOpacity: 0.55,
    jitter: c.kit.stoneJitter,
    rng: rng(`${c.seed}/${key}`),
  });
}

/** Soft ground shadow cast to the right, kept inside the 64 px frame. */
export function towerShadow(c: TowerCanvas): string {
  return dropShadow(c, {
    footprintW: 1.6,
    footprintD: 1.6,
    offset: 2.5,
    blur: 1.2,
    opacity: 0.4,
  });
}

/** Stone foundation slab covering most of the footprint (leaves ~2 px inside the frame). */
export function plinth(c: TowerCanvas, size = PLINTH, height = 4): string {
  const stone = shade(c.kit.stone, 0.85);
  return prism(c, {
    footprintW: size,
    footprintD: size,
    height,
    palette: faces(stone),
    left: masonry(c, 'plinth-l', height, 9),
    right: masonry(c, 'plinth-r', height, 9),
  });
}

/** Stone block with masonry on both visible faces. */
export function stoneBlock(
  c: TowerCanvas,
  key: string,
  s: {
    cx?: number;
    cy?: number;
    size: number;
    z: number;
    height: number;
    colour?: Hex;
    course?: number;
  },
): string {
  return prism(c, {
    cx: s.cx,
    cy: s.cy,
    footprintW: s.size,
    footprintD: s.size,
    z: s.z,
    height: s.height,
    palette: faces(s.colour ?? c.kit.stone),
    left: masonry(c, `${key}-l`, s.course),
    right: masonry(c, `${key}-r`, s.course),
  });
}

/** Thin team-coloured band wrapped around the visible faces of a box, `y` px below its top. */
export function teamBand(
  c: TowerCanvas,
  b: Box,
  y: number,
  height: number,
): string {
  const team = TEAM_COLOURS[c.team];
  const out: string[] = [];
  for (const [face, colour] of [
    ['left', team.main],
    ['right', shade(team.main, 0.68)],
  ] as const) {
    const { transform, w } = faceTransform(c.o, b, face);
    out.push(group({ transform }, rect(0, y, w, height, { fill: colour })));
  }
  return out.join('');
}

export type BannerStyle = 'swallowtail' | 'pennant' | 'tattered' | 'square';

export interface BannerOptions {
  /** Flag scale (1 ≈ 10 × 6.5 px). */
  readonly flag?: number;
  readonly style?: BannerStyle;
  /** Pole colour (default: dark faction wood). */
  readonly pole?: Hex;
  /** Finial / emblem colour (default: faction trim). */
  readonly trim?: Hex;
}

function flagPath(
  x: number,
  fy: number,
  fw: number,
  fh: number,
  style: BannerStyle,
): string {
  const P = (u: number, v: number): string =>
    `${num(x + fw * u)} ${num(fy + fh * v)}`;
  switch (style) {
    case 'pennant':
      return `M${P(0, 0)} Q${P(0.6, 0.1)} ${P(1.25, 0.45)} Q${P(0.6, 0.55)} ${P(0, 0.9)} Z`;
    case 'tattered':
      return `M${P(0, 0)} L${P(1, 0.05)} L${P(0.92, 0.55)} L${P(1, 0.78)} L${P(0.7, 0.64)} L${P(0.6, 1.18)} L${P(0.42, 0.72)} L${P(0.22, 1.1)} L${P(0, 0.82)} Z`;
    case 'square':
      return `M${P(0, 0)} L${P(0.85, 0)} L${P(0.85, 1)} L${P(0.42, 0.82)} L${P(0, 1)} Z`;
    case 'swallowtail':
      return `M${P(0, 0)} Q${P(0.5, -0.18)} ${P(1, 0.1)} L${P(0.78, 0.5)} L${P(1, 1.06)} Q${P(0.5, 0.85)} ${P(0, 1)} Z`;
  }
}

/** Banner in the team colour: pole from the world point (x, y, z), flag waving right. */
export function banner(
  c: TowerCanvas,
  at: readonly [number, number, number],
  pole: number,
  options: number | BannerOptions = {},
): string {
  const o: BannerOptions =
    typeof options === 'number' ? { flag: options } : options;
  const flag = o.flag ?? 1;
  const style = o.style ?? 'swallowtail';
  const trim = o.trim ?? c.kit.trim;
  const [x, y] = project(c.o, at[0], at[1], at[2]);
  const top = y - pole;
  const team = TEAM_COLOURS[c.team];
  const fw = 10 * flag;
  const fh = 6.5 * flag;
  const fy = top + 1.5;
  const fill = c.defs.linear([
    [0, team.light],
    [0.35, team.main],
    [1, team.dark],
  ]);
  return group(
    {},
    line([x, y], [x, top], {
      stroke: o.pole ?? shade(c.kit.wood, 0.7),
      'stroke-width': 1,
      'stroke-linecap': 'round',
    }),
    style === 'square'
      ? line([x - 0.5, fy], [x + fw * 0.9, fy], {
          stroke: o.pole ?? shade(c.kit.wood, 0.7),
          'stroke-width': 0.8,
        })
      : '',
    path(flagPath(x, fy, fw, fh, style), {
      fill,
      stroke: team.dark,
      'stroke-width': 0.4,
    }),
    // Faction emblem on the flag.
    style === 'pennant'
      ? ''
      : circle(x + fw * 0.4, fy + fh * 0.45, 1.2 * flag, { fill: trim }),
    circle(x, top - 0.6, 0.9, { fill: trim }),
  );
}

/** Soft glow halo (blurred disc) at a screen point. */
export function glow(
  c: TowerCanvas,
  at: Pt,
  r: number,
  colour: Hex,
  opacity = 0.8,
): string {
  return circle(at[0], at[1], r, {
    fill: colour,
    'fill-opacity': opacity,
    filter: c.defs.blur(r * 0.45),
  });
}

/** Glowing orb with a highlight, lit from the upper left. */
export function orb(c: TowerCanvas, at: Pt, r: number, colour: Hex): string {
  const fill = c.defs.radial(
    [
      [0, '#ffffff'],
      [0.35, mix(colour, '#ffffff', 0.5)],
      [1, colour],
    ],
    { cx: 0.38, cy: 0.35, r: 0.7 },
  );
  return group(
    {},
    glow(c, at, r * 1.9, colour, 0.55),
    circle(at[0], at[1], r, { fill }),
  );
}

/** Vertical slit window on a box face at face-local (u, v); `lit` adds a glow. */
export function slit(
  c: TowerCanvas,
  b: Box,
  face: Face,
  u: number,
  v: number,
  w: number,
  h: number,
  lit?: Hex,
): string {
  const { transform } = faceTransform(c.o, b, face);
  return group(
    { transform },
    lit
      ? [
          rect(u - 1, v - 1, w + 2, h + 2, {
            fill: lit,
            'fill-opacity': 0.7,
            filter: c.defs.blur(1),
          }),
          rect(u, v, w, h, { fill: lit }),
          rect(u, v, w, h * 0.35, { fill: '#ffffff', 'fill-opacity': 0.6 }),
        ]
      : rect(u, v, w, h, { fill: shade(c.kit.mortar, 0.5) }),
  );
}

/** Ground footprint ellipse (for auras), screen radii from a cell radius. */
export function auraEllipse(
  c: TowerCanvas,
  radius: number,
  colour: Hex,
  opacity: number,
): string {
  const [x, y] = project(c.o, 0, 0, 0);
  return ellipse(x, y, radius * 22.6, radius * 11.3, {
    fill: colour,
    'fill-opacity': opacity,
    filter: c.defs.blur(2),
  });
}

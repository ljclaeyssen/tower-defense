/**
 * Projectile sprites, keyed like the data (`<shape>-<faction>`). Elongated shapes (arrow, bolt,
 * gust) are 16×8 and point to +x (the renderer rotates them along the flight); the others are 12×12
 * and read well when spun.
 */
import { isFactionId } from '@td/shared';
import {
  KITS,
  PROJECTILE_BASE,
  PROJECTILE_SHAPES,
  mix,
  shade,
} from '../palette.js';
import type { Hex, ProjectileShape } from '../palette.js';
import {
  Defs,
  circle,
  ellipse,
  group,
  line,
  path,
  pathD,
  polygon,
  polyline,
  svgDoc,
} from '../svg.js';
import type { Pt } from '../svg.js';
import type { Sprite } from './types.js';

export const ELONGATED: readonly ProjectileShape[] = ['arrow', 'bolt', 'gust'];

export const projectileSize = (
  shape: ProjectileShape,
): { width: number; height: number } =>
  ELONGATED.includes(shape)
    ? { width: 16, height: 8 }
    : { width: 12, height: 12 };

export function parseProjectileId(visualId: string): {
  shape: ProjectileShape;
  accent: Hex;
} {
  const dash = visualId.indexOf('-');
  const shape = visualId.slice(0, dash);
  const faction = visualId.slice(dash + 1);
  if (dash <= 0 || !(PROJECTILE_SHAPES as readonly string[]).includes(shape))
    throw new Error(`Unknown projectile shape in "${visualId}"`);
  if (!isFactionId(faction))
    throw new Error(`Unknown faction in "${visualId}"`);
  return { shape: shape as ProjectileShape, accent: KITS[faction].accent };
}

interface Pen {
  readonly defs: Defs;
  readonly colour: Hex;
  readonly accent: Hex;
  readonly w: number;
  readonly h: number;
}

/** Spiral arms around (cx, cy) as polylines. */
function spiral(
  cx: number,
  cy: number,
  r: number,
  arms: number,
  sweep: number,
  attrs: Record<string, string | number>,
): string {
  const out: string[] = [];
  for (let a = 0; a < arms; a++) {
    const a0 = (a / arms) * Math.PI * 2;
    const points: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const ang = a0 + t * sweep;
      const rad = 0.6 + t * (r - 0.6);
      points.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    out.push(polyline(points, { 'stroke-linecap': 'round', ...attrs }));
  }
  return out.join('');
}

const DRAW: Readonly<Record<ProjectileShape, (p: Pen) => string>> = {
  arrow: ({ colour, accent }) =>
    group(
      {},
      // Shaft.
      line([2, 4], [12, 4], {
        stroke: shade('#a07a4a', 1.1),
        'stroke-width': 1.1,
        'stroke-linecap': 'round',
      }),
      // Steel head.
      polygon(
        [
          [14.8, 4],
          [11, 2],
          [12, 4],
          [11, 6],
        ],
        { fill: '#e8edf2', stroke: '#5b6470', 'stroke-width': 0.4 },
      ),
      // Fletching in the faction colour.
      polygon(
        [
          [1, 1.6],
          [4.6, 4],
          [1, 4],
        ],
        { fill: mix(accent, colour, 0.3) },
      ),
      polygon(
        [
          [1, 6.4],
          [4.6, 4],
          [1, 4],
        ],
        { fill: shade(mix(accent, colour, 0.3), 0.7) },
      ),
    ),
  bolt: ({ defs, colour }) => {
    const zig: Pt[] = [
      [2.5, 4.4],
      [5.2, 3],
      [7.8, 5],
      [10.6, 3.2],
      [13.5, 4],
    ];
    return group(
      {},
      polyline(zig, {
        stroke: colour,
        'stroke-width': 2.4,
        'stroke-opacity': 0.75,
        filter: defs.blur(0.7),
        'stroke-linejoin': 'round',
      }),
      polyline(zig, {
        stroke: colour,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      }),
      polyline(zig, {
        stroke: '#ffffff',
        'stroke-width': 0.6,
        'stroke-linejoin': 'round',
      }),
    );
  },
  gust: ({ defs, colour, accent }) =>
    group(
      {},
      path(
        'M15 4 Q10 -0.5 3 1.2 Q8.5 2.2 9.5 4 Q8.5 5.8 3 6.8 Q10 8.5 15 4 Z',
        {
          fill: colour,
          'fill-opacity': 0.5,
          filter: defs.blur(0.6),
        },
      ),
      path('M15 4 Q10 0.2 4 1.6 Q9 2.6 10 4 Q9 5.4 4 6.4 Q10 7.8 15 4 Z', {
        fill: colour,
      }),
      path('M14 4 Q10 2.2 6 2.4', {
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 0.5,
        'stroke-opacity': 0.8,
      }),
      ellipse(2.5, 2.4, 0.9, 0.5, { fill: shade(accent, 0.8) }),
      ellipse(1.5, 5.4, 0.8, 0.45, { fill: shade(accent, 0.7) }),
    ),
  swirl: ({ defs, colour }) =>
    group(
      {},
      circle(6, 6, 4.2, {
        fill: colour,
        'fill-opacity': 0.35,
        filter: defs.blur(0.6),
      }),
      spiral(6, 6, 4, 3, 2.6, {
        stroke: colour,
        'stroke-width': 1,
        fill: 'none',
      }),
      circle(6, 6, 1.6, { fill: '#ffffff' }),
    ),
  shard: ({ colour }) => {
    const top: Pt = [6, 1.5];
    const bottom: Pt = [6, 10.5];
    const left: Pt = [3, 6];
    const right: Pt = [9, 6];
    const mid: Pt = [6.4, 6.6];
    return group(
      {},
      polygon([top, mid, bottom, left], { fill: shade(colour, 1.2) }),
      polygon([top, right, bottom, mid], { fill: shade(colour, 0.7) }),
      polygon([top, right, bottom, left], {
        fill: 'none',
        stroke: shade(colour, 0.4),
        'stroke-width': 0.5,
      }),
      line(top, left, {
        stroke: '#ffffff',
        'stroke-width': 0.5,
        'stroke-opacity': 0.9,
      }),
    );
  },
  boulder: ({ defs, colour, accent }) => {
    const rock: Pt[] = [
      [2, 5],
      [3.5, 2.2],
      [7, 1.5],
      [10, 3.5],
      [10.5, 7],
      [8, 10.2],
      [4, 10],
      [1.8, 7.8],
    ];
    return group(
      {},
      polygon(rock, {
        fill: defs.radial(
          [
            [0, shade(colour, 1.5)],
            [0.55, colour],
            [1, shade(colour, 0.5)],
          ],
          { cx: 0.3, cy: 0.25, r: 0.85 },
        ),
        stroke: shade(colour, 0.3),
        'stroke-width': 0.6,
        'stroke-linejoin': 'round',
      }),
      path(
        pathD(
          [
            [5, 3.4],
            [6, 6],
            [8.6, 7],
          ],
          false,
        ),
        {
          fill: 'none',
          stroke: shade(colour, 0.4),
          'stroke-width': 0.5,
        },
      ),
      path(
        pathD(
          [
            [6, 6],
            [4.4, 8.4],
          ],
          false,
        ),
        {
          fill: 'none',
          stroke: mix(accent, '#ffffff', 0.2),
          'stroke-width': 0.6,
          'stroke-opacity': 0.8,
        },
      ),
    );
  },
  tornado: ({ defs, colour }) =>
    group(
      {},
      circle(6, 6, 4.4, {
        fill: colour,
        'fill-opacity': 0.25,
        filter: defs.blur(0.6),
      }),
      spiral(6, 6, 4.5, 3, 3, {
        stroke: colour,
        'stroke-width': 1.1,
        fill: 'none',
      }),
      spiral(6, 6, 3.2, 3, 2.6, {
        stroke: '#ffffff',
        'stroke-width': 0.5,
        'stroke-opacity': 0.8,
        fill: 'none',
      }),
      circle(6, 6, 1, { fill: '#ffffff' }),
    ),
  dust: ({ defs, colour }) =>
    group(
      {},
      circle(6, 6, 4.4, {
        fill: colour,
        'fill-opacity': 0.5,
        filter: defs.blur(0.6),
      }),
      spiral(6, 6, 4.4, 5, 2.4, {
        stroke: mix(colour, '#ffffff', 0.3),
        'stroke-width': 1,
        fill: 'none',
      }),
      circle(6, 6, 1.9, { fill: shade(colour, 0.5) }),
    ),
  wail: ({ defs, colour }) =>
    group(
      {},
      circle(6, 6, 4.4, {
        fill: colour,
        'fill-opacity': 0.25,
        filter: defs.blur(0.6),
      }),
      circle(6, 6, 4.4, {
        fill: colour,
        'fill-opacity': 0.2,
        stroke: colour,
        'stroke-width': 0.9,
      }),
      circle(6, 6, 3, {
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 0.4,
        'stroke-opacity': 0.6,
      }),
      circle(4.6, 5.2, 0.9, { fill: shade(colour, 0.3) }),
      circle(7.4, 5.2, 0.9, { fill: shade(colour, 0.3) }),
      ellipse(6, 7.6, 0.7, 1.1, { fill: shade(colour, 0.3) }),
    ),
};

export function generateProjectile(visualId: string): Sprite {
  const { shape, accent } = parseProjectileId(visualId);
  const { width, height } = projectileSize(shape);
  const base = PROJECTILE_BASE[shape];
  const defs = new Defs();
  const colour = mix(base.colour, accent, base.accentMix);
  const body = DRAW[shape]({ defs, colour, accent, w: width, h: height });
  return {
    svg: svgDoc(width, height, body, defs),
    width,
    height,
    pivot: { x: width / 2, y: height / 2 },
  };
}

/** 4×4 soft white dot for particles (tinted by the renderer). */
export function generateParticle(): Sprite {
  const defs = new Defs();
  const fill = defs.radial([
    [0, '#ffffff', 1],
    [0.5, '#ffffff', 0.8],
    [1, '#ffffff', 0],
  ]);
  return {
    svg: svgDoc(4, 4, circle(2, 2, 2, { fill }), defs),
    width: 4,
    height: 4,
    pivot: { x: 2, y: 2 },
  };
}

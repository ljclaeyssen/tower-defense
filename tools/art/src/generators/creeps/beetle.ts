/**
 * Beetle creep seen from above, facing +x, 16×16. Four-frame walk: alternating tripods (front-left,
 * middle-right, back-left vs the others) swing forward/back, the body bobs slightly. Light from the
 * upper left.
 */
import { CREEP, TEAM_COLOURS, mix, shade } from '../../palette.js';
import {
  Defs,
  circle,
  ellipse,
  group,
  line,
  path,
  polyline,
  svgDoc,
} from '../../svg.js';
import type { Pt } from '../../svg.js';
import type { CreepGenerator, CreepParams, Sprite } from '../types.js';

export const BEETLE_SIZE = 16;
export const WALK_FRAMES = 4;

interface Leg {
  /** Hip x along the body, side (-1 = left / −y, 1 = right / +y), rest angle forward (+) or back (−). */
  readonly hip: number;
  readonly side: -1 | 1;
  readonly reach: number;
  /** Tripod A (true) or B (false). */
  readonly tripodA: boolean;
}

const LEGS: readonly Leg[] = [
  { hip: 2.2, side: -1, reach: 2.4, tripodA: true },
  { hip: 0.6, side: 1, reach: 0.2, tripodA: true },
  { hip: -1, side: -1, reach: -2.4, tripodA: true },
  { hip: 2.2, side: 1, reach: 2.4, tripodA: false },
  { hip: 0.6, side: -1, reach: 0.2, tripodA: false },
  { hip: -1, side: 1, reach: -2.4, tripodA: false },
];

export function generateBeetle({ frame, team }: CreepParams): Sprite {
  const defs = new Defs();
  const c = BEETLE_SIZE / 2;
  const phase = ((frame % WALK_FRAMES) * Math.PI) / 2;
  const swing = Math.sin(phase); // 0, 1, 0, -1
  const bob = Math.cos(2 * phase) * 0.3; // +, -, +, -
  const shell = team
    ? mix(CREEP.shell, TEAM_COLOURS[team].main, 0.45)
    : CREEP.shell;
  const legColour = CREEP.legs;

  const legs = LEGS.map((leg) => {
    const s = (leg.tripodA ? swing : -swing) * 1.7;
    const hip: Pt = [c + leg.hip, c + leg.side * 2];
    const knee: Pt = [
      c + leg.hip + leg.reach * 0.5 + s * 0.5,
      c + leg.side * 4.6,
    ];
    const foot: Pt = [c + leg.hip + leg.reach + s, c + leg.side * 6.6];
    return polyline([hip, knee, foot], {
      stroke: legColour,
      'stroke-width': 0.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  });

  const bx = c + bob;
  const shellFill = defs.radial(
    [
      [0, shade(shell, 1.45)],
      [0.45, shell],
      [1, shade(shell, 0.55)],
    ],
    { cx: 0.35, cy: 0.3, r: 0.75 },
  );
  const antennae = [-1, 1].map((side) =>
    path(
      `M${bx + 5.6} ${c + side * 0.7} Q${bx + 7} ${c + side * 1.6} ${bx + 7.4} ${c + side * 3}`,
      {
        fill: 'none',
        stroke: legColour,
        'stroke-width': 0.45,
        'stroke-linecap': 'round',
      },
    ),
  );
  const mandibles = [-1, 1].map((side) =>
    path(
      `M${bx + 6.1} ${c + side * 0.8} Q${bx + 7.3} ${c + side * 0.9} ${bx + 7.2} ${c + side * 0.1}`,
      {
        fill: 'none',
        stroke: shade(legColour, 0.7),
        'stroke-width': 0.55,
        'stroke-linecap': 'round',
      },
    ),
  );
  const markings = team
    ? [
        circle(bx - 2.6, c - 1.6, 0.8, { fill: TEAM_COLOURS[team].light }),
        circle(bx - 2.6, c + 1.6, 0.8, { fill: TEAM_COLOURS[team].light }),
      ]
    : [
        circle(bx - 3, c - 1.7, 0.6, {
          fill: shade(shell, 0.6),
          'fill-opacity': 0.8,
        }),
        circle(bx - 3, c + 1.7, 0.6, {
          fill: shade(shell, 0.6),
          'fill-opacity': 0.8,
        }),
        circle(bx - 0.6, c - 2.1, 0.45, {
          fill: shade(shell, 0.6),
          'fill-opacity': 0.8,
        }),
        circle(bx - 0.6, c + 2.1, 0.45, {
          fill: shade(shell, 0.6),
          'fill-opacity': 0.8,
        }),
      ];

  // Scaled to 88 % around the centre so legs and antennae keep a margin inside the 16 px frame.
  const body = group(
    { transform: `translate(${c} ${c}) scale(0.88) translate(${-c} ${-c})` },
    legs,
    antennae,
    mandibles,
    // Head and pronotum.
    ellipse(bx + 5, c, 1.5, 1.7, { fill: shade(CREEP.belly, 0.9) }),
    circle(bx + 5.6, c - 1, 0.45, { fill: CREEP.eye }),
    circle(bx + 5.6, c + 1, 0.45, { fill: CREEP.eye }),
    ellipse(bx + 2.9, c, 2.1, 2.7, {
      fill: defs.radial(
        [
          [0, shade(shell, 1.1)],
          [1, shade(shell, 0.45)],
        ],
        { cx: 0.35, cy: 0.3, r: 0.8 },
      ),
      stroke: shade(shell, 0.3),
      'stroke-width': 0.4,
    }),
    // Elytra.
    ellipse(bx - 1.6, c, 5, 3.9, {
      fill: shellFill,
      stroke: shade(shell, 0.3),
      'stroke-width': 0.5,
    }),
    line([bx - 6.4, c], [bx + 2.2, c], {
      stroke: shade(shell, 0.35),
      'stroke-width': 0.45,
    }),
    markings,
    ellipse(bx - 2.6, c - 2, 1.6, 0.7, {
      fill: '#ffffff',
      'fill-opacity': 0.28,
    }),
  );
  return {
    svg: svgDoc(BEETLE_SIZE, BEETLE_SIZE, body, defs),
    width: BEETLE_SIZE,
    height: BEETLE_SIZE,
    pivot: { x: c, y: c },
  };
}

export function generateBeetleShadow(): Sprite {
  const defs = new Defs();
  const w = 16;
  const h = 8;
  const fill = defs.radial([
    [0, '#000000', 0.55],
    [0.6, '#000000', 0.35],
    [1, '#000000', 0],
  ]);
  return {
    svg: svgDoc(w, h, ellipse(w / 2, h / 2, w / 2, h / 2, { fill }), defs),
    width: w,
    height: h,
    pivot: { x: w / 2, y: h / 2 },
  };
}

export const BEETLE: CreepGenerator = {
  walk: generateBeetle,
  shadow: generateBeetleShadow,
};

/**
 * Slime creep seen from above, moving toward +x, 16×16. Four-frame squash-and-stretch hop:
 * round → stretched forward → round → squashed wide, translucent jelly with a darker core,
 * bubbles, a highlight from the upper left and two eyes on the leading edge.
 */
import { SLIME, TEAM_COLOURS, mix, shade } from '../../palette.js';
import { Defs, circle, ellipse, group, svgDoc } from '../../svg.js';
import type { CreepGenerator, CreepParams, Sprite } from '../types.js';
import { generateCreepShadow } from './shadow.js';

export const SLIME_SIZE = 16;

export function generateSlime({ frame, team }: CreepParams): Sprite {
  const defs = new Defs();
  const c = SLIME_SIZE / 2;
  const phase = ((((frame % 4) + 4) % 4) * Math.PI) / 2;
  const s = Math.sin(phase); // 0, 1, 0, -1
  const sx = 1 + 0.15 * s;
  const sy = 1 - 0.13 * s;
  const x = c + 0.6 * s;
  const rx = 5.2 * sx;
  const ry = 4.7 * sy;
  const body = team
    ? mix(SLIME.body, TEAM_COLOURS[team].main, 0.35)
    : SLIME.body;
  const fill = defs.radial(
    [
      [0, mix(body, '#ffffff', 0.45), 0.95],
      [0.55, body, 0.85],
      [1, shade(body, 0.55), 0.95],
    ],
    { cx: 0.38, cy: 0.32, r: 0.75 },
  );
  return {
    svg: svgDoc(
      SLIME_SIZE,
      SLIME_SIZE,
      group(
        {},
        // Wet trail left behind.
        ellipse(x - rx * 0.85, c + 0.4, rx * 0.45, ry * 0.45, {
          fill: body,
          'fill-opacity': 0.25,
        }),
        ellipse(x, c, rx, ry, {
          fill,
          stroke: SLIME.rim,
          'stroke-width': 0.5,
          'stroke-opacity': 0.8,
        }),
        ellipse(x - 0.6, c + 0.5, rx * 0.45, ry * 0.42, {
          fill: SLIME.core,
          'fill-opacity': 0.45,
        }),
        circle(x - rx * 0.35, c + ry * 0.35, 0.7, {
          fill: '#ffffff',
          'fill-opacity': 0.5,
        }),
        circle(x + rx * 0.05, c - ry * 0.45, 0.5, {
          fill: '#ffffff',
          'fill-opacity': 0.45,
        }),
        circle(x - rx * 0.6, c - ry * 0.05, 0.4, {
          fill: '#ffffff',
          'fill-opacity': 0.4,
        }),
        ellipse(x - rx * 0.32, c - ry * 0.42, rx * 0.36, ry * 0.2, {
          fill: '#ffffff',
          'fill-opacity': 0.6,
        }),
        // Eyes on the leading edge.
        circle(x + rx * 0.55, c - 1.2, 0.75, { fill: SLIME.eye }),
        circle(x + rx * 0.55, c + 1.2, 0.75, { fill: SLIME.eye }),
        circle(x + rx * 0.55 - 0.2, c - 1.4, 0.25, { fill: '#ffffff' }),
        circle(x + rx * 0.55 - 0.2, c + 1, 0.25, { fill: '#ffffff' }),
      ),
      defs,
    ),
    width: SLIME_SIZE,
    height: SLIME_SIZE,
    pivot: { x: c, y: c },
  };
}

export const SLIME_CREEP: CreepGenerator = {
  walk: generateSlime,
  shadow: generateCreepShadow,
};

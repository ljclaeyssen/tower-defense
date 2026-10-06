/** Soft elliptic ground shadow shared by the creeps (16×8 by default), pivot at the centre. */
import { Defs, ellipse, svgDoc } from '../../svg.js';
import type { Sprite } from '../types.js';

export function generateCreepShadow(width = 16, height = 8): Sprite {
  const defs = new Defs();
  const fill = defs.radial([
    [0, '#000000', 0.55],
    [0.6, '#000000', 0.35],
    [1, '#000000', 0],
  ]);
  return {
    svg: svgDoc(
      width,
      height,
      ellipse(width / 2, height / 2, width / 2, height / 2, { fill }),
      defs,
    ),
    width,
    height,
    pivot: { x: width / 2, y: height / 2 },
  };
}

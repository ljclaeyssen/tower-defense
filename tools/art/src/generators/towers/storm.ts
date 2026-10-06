/**
 * Pierce tower: slender stone spire on a square base, crowned by a cradle holding a floating orb
 * wrapped in a tornado swirl. One floating rune ring around the shaft per level.
 */
import { box, groundEllipse, prism, project, ringHalves } from '../../iso.js';
import { faces, mix, shade } from '../../palette.js';
import { group, line, path } from '../../svg.js';
import type { Pt } from '../../svg.js';
import type { Sprite, TowerParams } from '../types.js';
import {
  banner,
  finishTower,
  glow,
  orb,
  plinth,
  stoneBlock,
  teamBand,
  towerCanvas,
  towerShadow,
} from './parts.js';
import type { TowerCanvas } from './parts.js';

const HEIGHTS = [94, 104, 112] as const;

/** Tornado swirl around a screen point: tilted elliptic arcs of decreasing size. */
function swirl(
  c: TowerCanvas,
  at: Pt,
  r: number,
  colour: string,
): { back: string; front: string } {
  const back: string[] = [];
  const front: string[] = [];
  for (let i = 0; i < 3; i++) {
    const rx = r * (1.75 - i * 0.3);
    const ry = rx * 0.38;
    const cy = at[1] + r * (0.9 - i * 0.75);
    const tilt = -12 + i * 9;
    const arc = ringHalves({ x: at[0], y: cy, rx, ry });
    const attrs = {
      fill: 'none',
      stroke: i === 1 ? '#ffffff' : colour,
      'stroke-width': 1.1 - i * 0.2,
      'stroke-opacity': 0.85,
      'stroke-linecap': 'round',
      transform: `rotate(${tilt} ${at[0]} ${cy})`,
    };
    back.push(path(arc.back, { ...attrs, 'stroke-opacity': 0.45 }));
    front.push(path(arc.front, attrs));
  }
  return { back: group({}, back), front: group({}, front) };
}

export function generateStormTower(params: TowerParams): Sprite {
  const level = Math.min(3, Math.max(1, params.level));
  const c = towerCanvas('storm', params, HEIGHTS[level - 1] ?? 112);
  const { kit } = c;
  const glowColour = kit.glow.pierce;
  const baseH = 10;
  const shaftZ = 4 + baseH;
  const shaftH = 22 + 7 * level;
  const capZ = shaftZ + shaftH;
  const orbZ = capZ + 13;
  const orbR = 4.2 + 0.5 * level;
  const base = box(0, 0, 1.2, 1.2, 4, baseH);

  // Floating rune rings around the shaft (one per level), split so the shaft occludes them.
  const rings = Array.from({ length: level }, (_, i) => {
    const z = shaftZ + (shaftH * (i + 1)) / (level + 1);
    const e = groundEllipse(c.o, 0, 0, z, 0.56 - i * 0.04);
    const halves = ringHalves(e);
    const attrs = {
      fill: 'none',
      stroke: glowColour,
      'stroke-linecap': 'round',
    };
    return {
      back: path(halves.back, {
        ...attrs,
        'stroke-width': 0.9,
        'stroke-opacity': 0.55,
      }),
      front: group(
        {},
        path(halves.front, {
          ...attrs,
          'stroke-width': 2.4,
          'stroke-opacity': 0.5,
          filter: c.defs.blur(0.9),
        }),
        path(halves.front, { ...attrs, 'stroke-width': 1 }),
        path(halves.front, {
          fill: 'none',
          stroke: '#ffffff',
          'stroke-width': 0.4,
          'stroke-dasharray': '1.5 2.5',
        }),
      ),
    };
  });

  const orbAt = project(c.o, 0, 0, orbZ);
  const tornado = swirl(c, orbAt, orbR, glowColour);
  const trim = faces(kit.trim);
  const capTop = project(c.o, 0, 0, capZ + 3);
  // Cradle prongs from the left and right cap corners curving up around the orb.
  const prongs = [
    [-0.36, 0.36],
    [0.36, -0.36],
  ].map(([x, y]) => {
    const from = project(c.o, x ?? 0, y ?? 0, capZ + 3);
    const to: Pt = [
      orbAt[0] + (from[0] - capTop[0]) * 0.9,
      orbAt[1] + orbR * 0.4,
    ];
    return path(
      `M${from[0]} ${from[1]} Q${from[0] + (from[0] - capTop[0]) * 0.5} ${(from[1] + to[1]) / 2} ${to[0]} ${to[1]}`,
      {
        fill: 'none',
        stroke: shade(kit.trim, 0.7),
        'stroke-width': 1.1,
        'stroke-linecap': 'round',
      },
    );
  });

  return finishTower(
    c,
    towerShadow(c),
    plinth(c, 1.7, 4),
    stoneBlock(c, 'base', { size: 1.2, z: 4, height: baseH }),
    teamBand(c, base, 1.5, 2),
    rings.map((r) => r.back),
    stoneBlock(c, 'shaft', {
      size: 0.6,
      z: shaftZ,
      height: shaftH,
      course: 5,
      colour: shade(kit.stone, 1.05),
    }),
    rings.map((r) => r.front),
    banner(c, [0.48, -0.48, 4 + baseH], 16, 0.8),
    prism(c, {
      footprintW: 0.82,
      footprintD: 0.82,
      z: capZ,
      height: 3,
      palette: trim,
      ao: false,
    }),
    tornado.back,
    glow(c, orbAt, orbR * 2.4, glowColour, 0.28),
    orb(c, orbAt, orbR, mix(glowColour, kit.accent, 0.25)),
    tornado.front,
    prongs,
    line([orbAt[0], orbAt[1] - orbR - 1], [orbAt[0], orbAt[1] - orbR - 4], {
      stroke: '#ffffff',
      'stroke-width': 0.6,
      'stroke-opacity': 0.7,
    }),
  );
}

/**
 * Single-target tower: stone tower with a wooden platform and an archer, team banner.
 * Level 2 adds a second floor and crenellations; level 3 a roof (kit style) and glowing arrow slits.
 */
import { box, crenellations, planks, prism, project, roof } from '../../iso.js';
import { FIGURE, TEAM_COLOURS, faces, shade } from '../../palette.js';
import { group, line, path, polygon, circle } from '../../svg.js';
import type { Pt } from '../../svg.js';
import type { Sprite, TowerParams } from '../types.js';
import {
  banner,
  finishTower,
  plinth,
  slit,
  stoneBlock,
  teamBand,
  towerCanvas,
  towerShadow,
} from './parts.js';
import type { TowerCanvas } from './parts.js';

const HEIGHTS = [88, 104, 112] as const;

/** Archer standing at screen point p (feet), facing front-right with a drawn bow. */
export function archerFigure(c: TowerCanvas, p: Pt): string {
  const [x, y] = p;
  const team = TEAM_COLOURS[c.team];
  return group(
    {},
    line([x - 0.9, y], [x - 0.6, y - 3.2], {
      stroke: FIGURE.leather,
      'stroke-width': 1,
    }),
    line([x + 0.9, y], [x + 0.6, y - 3.2], {
      stroke: shade(FIGURE.leather, 0.7),
      'stroke-width': 1,
    }),
    polygon(
      [
        [x - 2, y - 3],
        [x + 2, y - 3],
        [x + 1.6, y - 7.6],
        [x - 1.6, y - 7.6],
      ],
      { fill: team.main, stroke: team.dark, 'stroke-width': 0.4 },
    ),
    polygon(
      [
        [x + 0.2, y - 3],
        [x + 2, y - 3],
        [x + 1.6, y - 7.6],
        [x + 0.2, y - 7.6],
      ],
      { fill: team.dark, 'fill-opacity': 0.45 },
    ),
    line([x + 1.2, y - 6.8], [x + 3.6, y - 7.2], {
      stroke: FIGURE.skin,
      'stroke-width': 0.8,
      'stroke-linecap': 'round',
    }),
    circle(x, y - 9.1, 1.6, { fill: FIGURE.skin }),
    path(
      `M${x - 1.7} ${y - 9} Q${x - 1.6} ${y - 11.3} ${x} ${y - 11} Q${x + 1.2} ${y - 10.9} ${x + 1.5} ${y - 9.6} Z`,
      {
        fill: shade(team.main, 0.7),
      },
    ),
    path(`M${x + 3.2} ${y - 11.6} Q${x + 6} ${y - 7.4} ${x + 3.2} ${y - 3}`, {
      fill: 'none',
      stroke: FIGURE.bow,
      'stroke-width': 0.9,
      'stroke-linecap': 'round',
    }),
    line([x + 3.2, y - 11.6], [x + 3.2, y - 3], {
      stroke: FIGURE.string,
      'stroke-width': 0.3,
    }),
  );
}

/** Wooden platform (balcony) of `size` cells at z, 3 px thick, with planks. */
function platform(c: TowerCanvas, size: number, z: number): string {
  const wood = faces(c.kit.wood);
  return prism(c, {
    footprintW: size,
    footprintD: size,
    z,
    height: 3,
    palette: wood,
    left: planks(3, shade(c.kit.wood, 0.5)),
    right: planks(3, shade(c.kit.wood, 0.4)),
    top: planks(3, shade(c.kit.wood, 0.75), 0.4),
    ao: false,
  });
}

export function generateArcherTower(params: TowerParams): Sprite {
  const level = Math.min(3, Math.max(1, params.level));
  const c = towerCanvas('archer', params, HEIGHTS[level - 1] ?? 112);
  const { kit } = c;
  const lit = level >= 3 ? kit.glow.slit : undefined;
  const parts: string[] = [towerShadow(c), plinth(c, undefined, 5)];

  if (level === 1) {
    const body = box(0, 0, 1.24, 1.24, 5, 26);
    parts.push(
      stoneBlock(c, 'body', { size: 1.24, z: 5, height: 26 }),
      teamBand(c, body, 2, 2),
      slit(c, body, 'left', 8.5, 9, 2, 6),
      slit(c, body, 'right', 8.5, 9, 2, 6),
    );
    const top = 34;
    const posts = crenellations(c, {
      footprintW: 1.5,
      footprintD: 1.5,
      z: top,
      size: 0.09,
      height: 5,
      count: 4,
      palette: faces(shade(kit.wood, 0.85)),
    });
    parts.push(
      platform(c, 1.5, 31),
      banner(c, [-0.66, -0.66, top], 22),
      posts.back,
      archerFigure(c, project(c.o, 0.1, 0.1, top)),
      posts.front,
      railing(c, 1.5, top + 3.5),
    );
    return finishTower(c, parts);
  }

  // Levels 2 and 3: two floors separated by a wooden balcony.
  const body1 = box(0, 0, 1.3, 1.3, 5, 22);
  const body2 = box(0, 0, 1.12, 1.12, 30, 20);
  parts.push(
    stoneBlock(c, 'body1', { size: 1.3, z: 5, height: 22 }),
    teamBand(c, body1, 2, 2),
    slit(c, body1, 'left', 9.4, 8, 2, 6, lit),
    slit(c, body1, 'right', 9.4, 8, 2, 6, lit),
    platform(c, 1.56, 27),
    stoneBlock(c, 'body2', { size: 1.12, z: 30, height: 20 }),
    slit(c, body2, 'left', 4, 6, 1.8, 6, lit),
    slit(c, body2, 'left', 12, 6, 1.8, 6, lit),
    slit(c, body2, 'right', 4, 6, 1.8, 6, lit),
    slit(c, body2, 'right', 12, 6, 1.8, 6, lit),
  );
  const top = 50;
  const merlons = crenellations(c, {
    footprintW: 1.12,
    footprintD: 1.12,
    z: top,
    size: 0.2,
    height: 5,
    count: 3,
    palette: faces(kit.stone),
  });
  if (level === 2) {
    parts.push(
      merlons.back,
      banner(c, [-0.46, -0.46, top + 5], 16),
      archerFigure(c, project(c.o, 0.05, 0.05, top)),
      merlons.front,
    );
    return finishTower(c, parts);
  }
  const roofH = 24;
  parts.push(
    merlons.back,
    merlons.front,
    roof(c, kit.roofStyle, {
      footprint: 1.5,
      z: top + 4,
      height: roofH,
      palette: faces(kit.roof),
      rows: 3,
    }),
    finial(c, top + 4 + roofH),
    banner(c, [0, 0, top + 4 + roofH], 12, 0.9),
  );
  return finishTower(c, parts);
}

/** Railing between the wooden posts (front edges only). */
function railing(c: TowerCanvas, size: number, z: number): string {
  const h = size / 2 - 0.05;
  const pts = [
    project(c.o, -h, h, z),
    project(c.o, h, h, z),
    project(c.o, h, -h, z),
  ];
  return path(`M${pts.map(([x, y]) => `${x} ${y}`).join(' L')}`, {
    fill: 'none',
    stroke: shade(c.kit.wood, 0.75),
    'stroke-width': 0.9,
  });
}

/** Small trim-coloured ball on a roof apex. */
function finial(c: TowerCanvas, z: number): string {
  const [x, y] = project(c.o, 0, 0, z);
  return circle(x, y, 1.4, {
    fill: c.kit.trim,
    stroke: shade(c.kit.trim, 0.5),
    'stroke-width': 0.4,
  });
}

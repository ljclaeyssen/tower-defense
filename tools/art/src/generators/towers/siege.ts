/**
 * Burst tower: squat bastion carrying a mortar barrel. The barrel grows each level; level 2 adds
 * crenellations and corner buttresses, level 3 iron bands and a bigger reinforced barrel.
 */
import {
  box,
  crenellations,
  faceTransform,
  prism,
  project,
} from '../../iso.js';
import { IRON, faces, mix, shade } from '../../palette.js';
import { circle, ellipse, group, path, pathD, rect } from '../../svg.js';
import type { Sprite, TowerParams } from '../types.js';
import {
  banner,
  finishTower,
  plinth,
  stoneBlock,
  teamBand,
  towerCanvas,
  towerShadow,
} from './parts.js';
import type { TowerCanvas } from './parts.js';

const HEIGHTS = [74, 82, 92] as const;

/** Mortar barrel standing on the point (screen) `at`, tilted toward the front-right. */
function mortar(
  c: TowerCanvas,
  at: readonly [number, number],
  radius: number,
  length: number,
  bands: number,
): string {
  const [x, y] = at;
  const iron = faces(IRON, 1.2);
  const body = c.defs.linear([
    [0, mix(iron.left, iron.top, 0.5)],
    [0.3, iron.top],
    [0.65, iron.left],
    [1, iron.right],
  ]);
  const ringColour = c.kit.metal;
  const parts: string[] = [
    // Breech.
    ellipse(0, 0, radius * 1.15, radius * 0.95, {
      fill: body,
      stroke: iron.edge,
      'stroke-width': 0.5,
    }),
    // Barrel, slightly flared at the muzzle.
    path(
      pathD([
        [-radius, 0],
        [-radius * 1.08, -length],
        [radius * 1.08, -length],
        [radius, 0],
      ]),
      { fill: body, stroke: iron.edge, 'stroke-width': 0.5 },
    ),
  ];
  for (let i = 1; i <= bands; i++) {
    const by = (-length * i) / (bands + 1);
    parts.push(
      rect(-radius * 1.06, by - 0.9, radius * 2.12, 1.8, {
        fill: ringColour,
        stroke: shade(ringColour, 0.5),
        'stroke-width': 0.3,
      }),
    );
  }
  parts.push(
    ellipse(0, -length, radius * 1.25, radius * 0.55, {
      fill: ringColour,
      stroke: shade(ringColour, 0.45),
      'stroke-width': 0.5,
    }),
    ellipse(0, -length, radius * 0.85, radius * 0.36, { fill: '#0b0a0a' }),
  );
  return group({ transform: `translate(${x} ${y}) rotate(28)` }, parts);
}

export function generateSiegeTower(params: TowerParams): Sprite {
  const level = Math.min(3, Math.max(1, params.level));
  const c = towerCanvas('siege', params, HEIGHTS[level - 1] ?? 92);
  const { kit } = c;
  const wallH = 12 + 2 * level;
  const size = 1.44;
  const top = 4 + wallH;
  const bastion = box(0, 0, size, size, 4, wallH);
  const parts: string[] = [towerShadow(c), plinth(c)];

  // Buttresses at the corners (level 2+), drawn back to front around the bastion.
  const buttress = (x: number, y: number): string =>
    stoneBlock(c, `buttress${x}${y}`, {
      cx: x,
      cy: y,
      size: 0.3,
      z: 4,
      height: wallH + 2,
      colour: shade(kit.stone, 0.92),
      course: 4,
    });
  const h = size / 2;
  if (level >= 2) parts.push(buttress(-h, -h));
  parts.push(stoneBlock(c, 'bastion', { size, z: 4, height: wallH }));
  parts.push(teamBand(c, bastion, 2, 2));
  if (level >= 3) {
    // Iron bands with rivets on both visible faces.
    for (const face of ['left', 'right'] as const) {
      const { transform, w } = faceTransform(c.o, bastion, face);
      const rivets = Array.from({ length: Math.floor(w / 5) }, (_, i) =>
        circle(2.5 + i * 5, wallH - 3, 0.6, { fill: shade(kit.metal, 1.3) }),
      );
      parts.push(
        group(
          { transform },
          rect(0, wallH - 4.5, w, 3, {
            fill: face === 'left' ? kit.metal : shade(kit.metal, 0.62),
          }),
          rivets,
        ),
      );
    }
  }
  if (level >= 2) parts.push(buttress(h, -h), buttress(-h, h));

  // Turntable and barrel.
  const turntable = prism(c, {
    footprintW: 0.8,
    footprintD: 0.8,
    z: top,
    height: 3,
    palette: faces(kit.wood),
    ao: false,
  });
  const merlons =
    level >= 2
      ? crenellations(c, {
          footprintW: size,
          footprintD: size,
          z: top,
          size: 0.24,
          height: 4,
          count: 4,
          palette: faces(kit.stone),
        })
      : { back: '', front: '' };
  const barrelAt = project(c.o, 0, 0, top + 5);
  parts.push(
    merlons.back,
    banner(c, [-h + 0.15, -h + 0.15, top + (level >= 2 ? 4 : 0)], 16, 0.85),
    turntable,
    mortar(c, barrelAt, 4 + level * 0.8, 9 + level * 2.5, level),
    merlons.front,
  );
  if (level >= 2) parts.push(buttress(h, h));
  return finishTower(c, parts);
}

/**
 * Elves: organic, slender, curved. Living trunks spiralling upward, layered leaf canopies, pale
 * marble rings and arcs, crescent moons, hanging lanterns, roots and flowers. No straight walls.
 */
import { cylinder, groundEllipse } from '../../../iso.js';
import { ELF, TEAM_COLOURS, faces, mix, shade } from '../../../palette.js';
import type { Hex } from '../../../palette.js';
import { rng } from '../../../random.js';
import { ellipse, group, line, num, path } from '../../../svg.js';
import type { Pt } from '../../../svg.js';
import type { Sprite, TowerParams } from '../../types.js';
import { archerFigure } from './humans/archer.js';
import {
  at,
  canopy,
  crescent,
  flowers,
  iceShard,
  isoRing,
  lantern,
  leaf,
  roots,
  sparkle,
  trunk,
} from '../ornaments.js';
import {
  banner,
  finishTower,
  glow,
  orb,
  towerCanvas,
  towerShadow,
} from '../parts.js';
import type { TowerCanvas } from '../parts.js';
import type { FactionTowers } from './types.js';

const lvl = (p: TowerParams): number => Math.min(3, Math.max(1, p.level));

/** Mossy mound with roots and flowers: the ground every elven tower grows from. */
function mound(c: TowerCanvas, radius: number, rootCount: number): string {
  const e = groundEllipse(c.o, 0, 0, 0, radius);
  return group(
    {},
    ellipse(e.x, e.y, e.rx, e.ry, {
      fill: c.defs.radial(
        [
          [0, ELF.moss],
          [0.7, mix(ELF.moss, ELF.earth, 0.5)],
          [1, ELF.earth],
        ],
        { cx: 0.4, cy: 0.4, r: 0.6 },
      ),
    }),
    roots(c, 0, 0, rootCount, radius * 0.95, ELF.bark, `${c.seed}/roots`),
    flowers(
      c,
      0,
      0,
      radius * 0.75,
      4 + c.level * 2,
      ELF.flowers,
      `${c.seed}/flowers`,
    ),
  );
}

/** Team ribbon tied around a trunk at screen point p (half width w), tails fluttering right. */
function ribbon(c: TowerCanvas, p: Pt, w: number): string {
  const team = TEAM_COLOURS[c.team];
  const [x, y] = p;
  return group(
    {},
    path(
      `M${num(x - w)} ${num(y)} Q${num(x)} ${num(y + w * 0.7)} ${num(x + w)} ${num(y)} L${num(x + w)} ${num(y + 2)} Q${num(x)} ${num(y + 2 + w * 0.7)} ${num(x - w)} ${num(y + 2)} Z`,
      {
        fill: team.main,
        stroke: team.dark,
        'stroke-width': 0.3,
      },
    ),
    path(
      `M${num(x + w * 0.6)} ${num(y + 1.5)} Q${num(x + w + 4)} ${num(y + 3)} ${num(x + w + 7)} ${num(y + 1)} L${num(x + w + 6)} ${num(y + 4)} Q${num(x + w + 3)} ${num(y + 5)} ${num(x + w * 0.6)} ${num(y + 3)} Z`,
      {
        fill: team.main,
        stroke: team.dark,
        'stroke-width': 0.3,
      },
    ),
  );
}

/** Ranger bower: living tree, platform in the canopy with an archer, leaf roof; marble ribs and lanterns grow with levels. */
function ranger(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas('elf-ranger', params, [90, 98, 112][level - 1] ?? 112);
  const T = 30 + 5 * level;
  const zP = 3 + T;
  const plat = at(c, [0, 0, zP]);
  const roofZ = zP + 23;
  // Curved branches carrying the platform, from the trunk out to the rim.
  const strut = (side: -1 | 1): string => {
    const from = at(c, [0, 0, zP - 12]);
    const to = at(c, [side * 0.42, -side * 0.42, zP]);
    const dd = `M${num(from[0])} ${num(from[1])} Q${num(from[0] + side * 3)} ${num(to[1] + 1)} ${num(to[0])} ${num(to[1])}`;
    return group(
      {},
      path(dd, {
        fill: 'none',
        stroke: shade(ELF.bark, 0.45),
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
      path(dd, {
        fill: 'none',
        stroke: side < 0 ? ELF.bark : shade(ELF.bark, 0.75),
        'stroke-width': 2,
        'stroke-linecap': 'round',
      }),
    );
  };
  const parts: string[] = [
    towerShadow(c),
    mound(c, 0.86, 7),
    trunk(c, {
      z: 0,
      height: T + 3,
      base: 4.2,
      top: 3,
      sway: 3.2,
      waves: 1.3,
      colour: ELF.bark,
      grooves: 3,
      turns: 1.6,
      flare: 1.1,
    }),
    strut(-1),
    strut(1),
  ];
  // Canopy behind the platform, then the platform, the archer and the leaf roof.
  parts.push(
    canopy(c, {
      at: [plat[0] - 1, plat[1] - 11],
      rx: 24,
      ry: 10,
      colour: ELF.leafDeep,
      seed: `${c.seed}/back`,
      clumps: 11,
    }),
  );
  const rim = isoRing(c, 0, 0, zP + 2, 0.56, 1.3, ELF.marble);
  parts.push(
    cylinder(c, {
      radius: 0.56,
      z: zP,
      height: 2,
      palette: faces(c.kit.wood),
      rows: 0,
    }),
    rim.back,
  );
  if (level >= 2) {
    // Marble ribs arching from the platform rim up to the roof: the bower's bow-like silhouette.
    for (const side of [-1, 1] as const) {
      const foot = at(c, [side * 0.45, -side * 0.45, zP + 2]);
      const top = at(c, [0, 0, roofZ - 4]);
      const dd = `M${num(foot[0])} ${num(foot[1])} Q${num(foot[0] + side * 4)} ${num((foot[1] + top[1]) / 2)} ${num(top[0] + side * 3)} ${num(top[1])}`;
      parts.push(
        path(dd, {
          fill: 'none',
          stroke: shade(ELF.marble, 0.6),
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
        }),
        path(dd, {
          fill: 'none',
          stroke: ELF.marble,
          'stroke-width': 1.4,
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  parts.push(
    archerFigure(c, at(c, [0.05, 0.05, zP + 2])),
    rim.front,
    banner(c, [0.45, -0.45, zP + 2], 9, {
      style: 'pennant',
      flag: 0.8,
      pole: ELF.gold,
      trim: ELF.gold,
    }),
    canopy(c, {
      at: at(c, [0, 0, roofZ]),
      rx: 18 + level,
      ry: 7.5,
      colour: ELF.leaf,
      seed: `${c.seed}/roof`,
      clumps: 9,
    }),
  );
  if (level >= 2) {
    const r = at(c, [0, 0, roofZ]);
    parts.push(
      lantern(c, [r[0] - 13, r[1] + 3], 6, ELF.lantern, ELF.gold),
      lantern(c, [r[0] + 12, r[1] + 4], 5, ELF.lantern, ELF.gold),
    );
  }
  if (level >= 3) {
    const top = at(c, [0, 0, roofZ + 8]);
    parts.push(
      canopy(c, {
        at: top,
        rx: 12,
        ry: 5.5,
        colour: mix(ELF.leaf, ELF.moon, 0.2),
        seed: `${c.seed}/crown`,
        clumps: 7,
      }),
      glow(c, [top[0], top[1] - 7], 5, ELF.moon, 0.5),
      crescent([top[0], top[1] - 7], 4, -90, {
        fill: ELF.moon,
        stroke: ELF.gold,
        'stroke-width': 0.5,
      }),
    );
  }
  return finishTower(c, parts);
}

/** Leaf ring floating around a vertical axis; returns far and near halves. */
function leafRing(
  c: TowerCanvas,
  z: number,
  radius: number,
  count: number,
  seed: string,
): { back: string; front: string } {
  const r = rng(seed);
  const e = groundEllipse(c.o, 0, 0, z, radius);
  const back: string[] = [];
  const front: string[] = [];
  const trail = isoRing(c, 0, 0, z, radius, 0.5, ELF.moon);
  back.push(group({ opacity: 0.35 }, trail.back));
  front.push(group({ opacity: 0.45 }, trail.front));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r.range(-0.15, 0.15);
    const p: Pt = [e.x + Math.cos(a) * e.rx, e.y + Math.sin(a) * e.ry];
    const deg =
      (Math.atan2(e.ry * Math.cos(a), -e.rx * Math.sin(a)) * 180) / Math.PI;
    const colour = i % 2 ? ELF.leaf : ELF.leafTeal;
    const lit = Math.cos(a) < 0 ? shade(colour, 1.15) : shade(colour, 0.85);
    (Math.sin(a) < 0 ? back : front).push(
      leaf(p, 5, deg, Math.sin(a) < 0 ? shade(lit, 0.8) : lit),
    );
  }
  return { back: group({}, back), front: group({}, front) };
}

/** Wind singer: white birch spiralling upward, crowned by rings of floating leaves around a glowing seed. */
function windsinger(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'elf-windsinger',
    params,
    [96, 104, 112][level - 1] ?? 112,
  );
  const T = 40 + 6 * level;
  const zTop = 4 + T;
  const rings = Array.from({ length: level }, (_, k) =>
    leafRing(
      c,
      zTop + 3 + k * 8,
      0.62 - k * 0.12,
      11 - k * 2,
      `${c.seed}/ring${k}`,
    ),
  );
  const seedAt = at(c, [0, 0, zTop + 8 + (level - 1) * 4]);
  const branch = (side: -1 | 1, z: number): string => {
    const p = at(c, [0, 0, z]);
    const tip: Pt = [p[0] + side * 9, p[1] - 6];
    return group(
      {},
      path(
        `M${num(p[0])} ${num(p[1])} Q${num(p[0] + side * 6)} ${num(p[1] - 1)} ${num(tip[0])} ${num(tip[1])}`,
        {
          fill: 'none',
          stroke: shade(ELF.birch, 0.7),
          'stroke-width': 1.1,
          'stroke-linecap': 'round',
        },
      ),
      leaf(
        tip,
        4.5,
        side * 30,
        side < 0 ? ELF.leaf : shade(ELF.leafTeal, 0.85),
      ),
    );
  };
  return finishTower(
    c,
    towerShadow(c),
    mound(c, 0.78, 5),
    cylinder(c, {
      radius: 0.4,
      z: 0,
      height: 4,
      palette: faces(ELF.marble),
      rows: 1,
    }),
    rings.map((r) => r.back),
    trunk(c, {
      z: 4,
      height: T,
      base: 4.6,
      top: 2.2,
      sway: 3.5,
      waves: 2,
      colour: ELF.birch,
      grooves: 4,
      turns: 2.6,
      flare: 0.6,
    }),
    branch(-1, 4 + T * 0.55),
    level >= 2 ? branch(1, 4 + T * 0.72) : '',
    ribbon(c, at(c, [0, 0, 14]), 4.4),
    glow(c, seedAt, 9, c.kit.glow.pierce, 0.4),
    orb(c, seedAt, 3 + level * 0.4, mix(c.kit.glow.pierce, ELF.leaf, 0.3)),
    rings.map((r) => r.front),
  );
}

/** Moon shrine: marble basin with a glowing pool, crescent altar above, ice shards rising at higher levels. */
function moonshrine(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'elf-moonshrine',
    params,
    [82, 94, 106][level - 1] ?? 106,
  );
  const basinH = 7;
  const pool = groundEllipse(c.o, 0, 0, basinH, 0.62);
  const stemTop = 22 + 8 * level;
  const moonR = 6 + 1.6 * level;
  const moonAt = at(c, [-0.15, -0.15, stemTop + moonR * 0.5]);
  const team = TEAM_COLOURS[c.team];
  const drape = at(c, [0.55, 0.55, basinH]);
  const shards =
    level >= 2
      ? [
          { x: 0.2, y: 0.1, height: 10 + level * 3, width: 2.6, lean: 0.12 },
          { x: -0.1, y: 0.25, height: 7 + level * 2, width: 2.2, lean: -0.2 },
          ...(level >= 3
            ? [
                { x: 0.3, y: -0.15, height: 8, width: 2, lean: 0.3 },
                { x: -0.3, y: 0.05, height: 9, width: 2.2, lean: -0.3 },
              ]
            : []),
        ].sort((a, b) => a.x + a.y - (b.x + b.y))
      : [];
  const stem = (side: -1 | 1): string => {
    const foot = at(c, [-0.15 + side * 0.32, -0.15 - side * 0.32, basinH]);
    const dd = `M${num(foot[0])} ${num(foot[1])} Q${num(foot[0] - side * 2)} ${num((foot[1] + moonAt[1]) / 2)} ${num(moonAt[0] + side * moonR * 0.55)} ${num(moonAt[1] + moonR * 0.5)}`;
    return group(
      {},
      path(dd, {
        fill: 'none',
        stroke: shade(ELF.marble, 0.55),
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
      }),
      path(dd, {
        fill: 'none',
        stroke: side < 0 ? ELF.marble : shade(ELF.marble, 0.8),
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
      }),
    );
  };
  const ripples = [0.35, 0.6, 0.85].map((k) =>
    ellipse(pool.x, pool.y, pool.rx * k, pool.ry * k, {
      fill: 'none',
      stroke: '#ffffff',
      'stroke-opacity': 0.35,
      'stroke-width': 0.4,
    }),
  );
  return finishTower(
    c,
    towerShadow(c),
    mound(c, 0.86, 4),
    cylinder(c, {
      radius: 0.74,
      z: 0,
      height: basinH,
      palette: faces(ELF.marble),
      rows: 1,
    }),
    ellipse(pool.x, pool.y, pool.rx, pool.ry, {
      fill: c.defs.radial([
        [0, '#ffffff'],
        [0.45, ELF.pool],
        [1, shade(ELF.pool, 0.55)],
      ]),
    }),
    ripples,
    // Team cloth draped over the basin's front rim.
    path(
      `M${num(drape[0] - 4)} ${num(drape[1] - 0.5)} Q${num(drape[0])} ${num(drape[1] + 1.5)} ${num(drape[0] + 4)} ${num(drape[1] - 1)} L${num(drape[0] + 3)} ${num(drape[1] + 5.5)} L${num(drape[0])} ${num(drape[1] + 4.5)} L${num(drape[0] - 3)} ${num(drape[1] + 5)} Z`,
      {
        fill: team.main,
        stroke: team.dark,
        'stroke-width': 0.3,
      },
    ),
    glow(c, [pool.x, pool.y - 4], 14, c.kit.glow.slow, 0.35),
    stem(-1),
    stem(1),
    glow(c, moonAt, moonR * 1.5, ELF.moon, 0.35 + 0.05 * level),
    crescent(moonAt, moonR, -90, {
      fill: c.defs.linear([
        [0, '#ffffff'],
        [0.5, ELF.moon],
        [1, shade(ELF.marbleVein, 0.9)],
      ]),
      stroke: ELF.gold,
      'stroke-width': 0.6,
    }),
    shards.map((s) => iceShard(c, s, basinH, c.kit.ice)),
    level >= 3
      ? [
          sparkle([moonAt[0] - 13, moonAt[1] + 4], 1.8, '#ffffff'),
          sparkle([moonAt[0] + 12, moonAt[1] - 3], 1.5, ELF.moon),
          sparkle([moonAt[0] + 2, moonAt[1] - moonR - 6], 1.6, '#ffffff'),
        ]
      : '',
  );
}

/**
 * Great recurve bow lying across the stock at F: limbs bulge toward the shot (+x on screen), tips
 * curl back, string drawn to the nock behind F.
 */
function recurveBow(F: Pt, span: number, colour: Hex): string {
  const [x, y] = F;
  const top: Pt = [x - 3, y - span];
  const bottom: Pt = [x - 3, y + span];
  const limbs = `M${num(top[0] + 2.5)} ${num(top[1] - 1.5)} Q${num(top[0] + 1)} ${num(top[1] - 0.5)} ${num(top[0])} ${num(top[1])} C${num(x + 6)} ${num(y - span * 0.55)} ${num(x + 6)} ${num(y + span * 0.55)} ${num(bottom[0])} ${num(bottom[1])} Q${num(bottom[0] + 1)} ${num(bottom[1] + 0.5)} ${num(bottom[0] + 2.5)} ${num(bottom[1] + 1.5)}`;
  return group(
    {},
    path(
      `M${num(top[0])} ${num(top[1])} L${num(x - 9)} ${num(y)} L${num(bottom[0])} ${num(bottom[1])}`,
      {
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 0.4,
        'stroke-opacity': 0.9,
      },
    ),
    path(limbs, {
      fill: 'none',
      stroke: shade(colour, 0.4),
      'stroke-width': 2.6,
      'stroke-linecap': 'round',
    }),
    path(limbs, {
      fill: 'none',
      stroke: colour,
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
    }),
    leaf([top[0] + 3, top[1] - 2], 3.2, -30, ELF.leaf),
    leaf([bottom[0] + 3, bottom[1] + 2], 3.2, 30, shade(ELF.leaf, 0.8)),
  );
}

/** Ballista: great recurve bow-machine on a raised root platform; more bows and moon ornaments per level. */
function ballista(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas('elf-ballista', params, [80, 88, 96][level - 1] ?? 96);
  const platZ = 7;
  const rim = isoRing(c, 0, 0, platZ, 0.66, 1.3, ELF.marble);
  const e = groundEllipse(c.o, 0, 0, platZ, 0.62);
  const deck = ellipse(e.x, e.y, e.rx, e.ry, { fill: c.kit.wood });
  const postH = 8 + 2 * level;
  const post = at(c, [0, 0, platZ + postH]);
  const F: Pt = [post[0] + 2, post[1] - 3];
  // Bows stacked upward on L2/L3 (repeating ballista), the largest at the bottom.
  const bows = Array.from({ length: level }, (_, i) =>
    recurveBow(
      [F[0] - i * 2, F[1] - i * 4.5],
      9 + level - i * 1.5,
      i === 0 ? ELF.gold : mix(ELF.gold, ELF.marble, 0.45),
    ),
  ).reverse();
  const machine = group(
    { transform: `rotate(-12 ${num(F[0])} ${num(F[1])})` },
    // Stock under the bolt.
    line([F[0] - 14, F[1] + 1.8], [F[0] + 5, F[1] + 1.8], {
      stroke: shade(c.kit.wood, 0.4),
      'stroke-width': 3.4,
      'stroke-linecap': 'round',
    }),
    line([F[0] - 14, F[1] + 1.8], [F[0] + 5, F[1] + 1.8], {
      stroke: c.kit.wood,
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
    }),
    bows,
    // Bolt with a leaf head.
    line([F[0] - 11, F[1]], [F[0] + 11, F[1]], {
      stroke: '#f4f0e0',
      'stroke-width': 0.9,
    }),
    leaf([F[0] + 13, F[1]], 5, 0, ELF.leafTeal),
    level >= 2
      ? crescent([F[0] - 15, F[1] + 1], 3.2, 180, {
          fill: ELF.moon,
          stroke: ELF.gold,
          'stroke-width': 0.4,
        })
      : '',
  );
  return finishTower(
    c,
    towerShadow(c),
    mound(c, 0.88, 7),
    cylinder(c, {
      radius: 0.66,
      z: 0,
      height: platZ,
      palette: faces(ELF.bark),
      rows: 2,
    }),
    rim.back,
    deck,
    rim.front,
    banner(c, [-0.42, -0.42, platZ], 14 + level * 2, {
      style: 'pennant',
      flag: 0.8,
      pole: ELF.gold,
      trim: ELF.gold,
    }),
    trunk(c, {
      z: platZ,
      height: postH,
      base: 3,
      top: 1.8,
      sway: 1,
      colour: ELF.marble,
      flare: 0.8,
    }),
    machine,
  );
}

export const ELF_TOWERS: FactionTowers = {
  single: ranger,
  pierce: windsinger,
  slow: moonshrine,
  burst: ballista,
};

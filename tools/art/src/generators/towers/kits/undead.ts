/**
 * Undead: gothic and necrotic. Dark crypt stone, steep slate spires, pointed arches, black iron
 * spikes and railings, bone ribcages, skulls, tilted gravestones, tattered banners, green soul-fire.
 */
import {
  bricks,
  box,
  groundEllipse,
  onFace,
  prism,
  pyramidRoof,
  ringHalves,
} from '../../../iso.js';
import type { FacePattern } from '../../../iso.js';
import { TEAM_COLOURS, UNDEAD, faces, mix, shade } from '../../../palette.js';
import { rng } from '../../../random.js';
import {
  circle,
  ellipse,
  group,
  line,
  num,
  path,
  polygon,
  rect,
} from '../../../svg.js';
import type { Pt } from '../../../svg.js';
import type { Sprite, TowerParams } from '../../types.js';
import {
  at,
  ballFill,
  bone,
  brazier,
  gothicArchD,
  gothicWindow,
  gravestone,
  iceShard,
  isoRing,
  railing,
  skull,
  smoke,
  spike,
  wisp,
} from '../ornaments.js';
import type { P3 } from '../ornaments.js';
import {
  banner,
  finishTower,
  glow,
  towerCanvas,
  towerShadow,
} from '../parts.js';
import type { TowerCanvas } from '../parts.js';
import type { FactionTowers } from './types.js';

const lvl = (p: TowerParams): number => Math.min(3, Math.max(1, p.level));

const crypt = (c: TowerCanvas, key: string): FacePattern =>
  bricks({
    course: 5,
    brick: 9,
    mortar: shade(UNDEAD.stone, 0.45),
    mortarOpacity: 0.7,
    jitter: 0.1,
    rng: rng(`${c.seed}/${key}`),
  });

/** Dead earth with tilted gravestones behind and bones scattered in front. */
function graveyard(
  c: TowerCanvas,
  radius: number,
  stones: readonly P3[],
): string {
  const e = groundEllipse(c.o, 0, 0, 0, radius);
  const r = rng(`${c.seed}/graves`);
  const bones: string[] = [];
  for (let i = 0; i < 2; i++) {
    const a = at(c, [r.range(0.1, 0.7), r.range(0.55, 0.8), 0]);
    bones.push(
      bone(
        a,
        [a[0] + r.range(3, 4.5), a[1] + r.range(-1, 1)],
        0.8,
        UNDEAD.bone,
      ),
    );
  }
  return group(
    {},
    ellipse(e.x, e.y, e.rx, e.ry, {
      fill: c.defs.radial([
        [0, UNDEAD.earth],
        [0.8, shade(UNDEAD.earth, 0.75)],
        [1, shade(UNDEAD.earth, 0.6), 0.6],
      ]),
    }),
    stones.map((p, i) =>
      gravestone(c, p, 3.6, 5.5, i % 2 ? 9 : -12, UNDEAD.grave),
    ),
    bones,
  );
}

/** Stone block in crypt masonry. */
function cryptBlock(
  c: TowerCanvas,
  key: string,
  s: { size: number; z: number; height: number; colour?: string },
): string {
  return prism(c, {
    footprintW: s.size,
    footprintD: s.size,
    z: s.z,
    height: s.height,
    palette: faces(s.colour ?? UNDEAD.stone, 1.15),
    left: crypt(c, `${key}l`),
    right: crypt(c, `${key}r`),
  });
}

/** Iron spike finial on a roof apex. */
function finial(p: Pt, h: number): string {
  return group(
    {},
    line(p, [p[0], p[1] - h], { stroke: UNDEAD.iron, 'stroke-width': 1 }),
    spike([p[0], p[1] - h + 1], 4, 2, 0, UNDEAD.iron),
    circle(p[0], p[1] - h * 0.45, 1, { fill: UNDEAD.iron }),
  );
}

const tattered = (c: TowerCanvas, p: P3, pole: number): string =>
  banner(c, p, pole, {
    style: 'tattered',
    flag: 0.9,
    pole: UNDEAD.iron,
    trim: UNDEAD.bone,
  });

/** Skeleton archer: crypt turret with a glowing gothic window, bone trim and a steep slate spire. */
function skeletonarcher(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'undead-skeletonarcher',
    params,
    [96, 106, 112][level - 1] ?? 112,
  );
  const size = 0.96;
  const bodyH = 26 + 4 * level;
  const z0 = 4;
  const top = z0 + bodyH;
  const half = size / 2;
  const roofH = 22 + 2 * level;
  // Levels 2-3: an iron-railed gallery splits the body; the window sits on the upper part.
  const gz = level >= 2 ? z0 + 12 : z0;
  const upper = box(0, 0, size, size, gz, top - gz);
  const winH = Math.min(16, top - gz - 8);
  const window = (w: number): string =>
    group(
      {},
      gothicWindow(
        (w - 8) / 2,
        5,
        8,
        winH,
        UNDEAD.soul,
        shade(UNDEAD.stone, 0.5),
      )(w, winH),
      // A skeleton bowman in the window.
      circle(w / 2 - 0.8, 5 + winH * 0.45, 1.5, { fill: UNDEAD.bone }),
      line([w / 2 - 0.8, 6.5 + winH * 0.45], [w / 2 - 0.8, 5 + winH * 0.85], {
        stroke: UNDEAD.bone,
        'stroke-width': 0.8,
      }),
      path(
        `M${num(w / 2 + 1.5)} ${num(5 + winH * 0.3)} Q${num(w / 2 + 3.5)} ${num(5 + winH * 0.6)} ${num(w / 2 + 1.5)} ${num(5 + winH * 0.92)}`,
        {
          fill: 'none',
          stroke: shade(UNDEAD.bone, 0.6),
          'stroke-width': 0.6,
        },
      ),
    );
  const g = 0.66;
  const parts: string[] = [
    towerShadow(c),
    graveyard(c, 0.95, [
      [-0.75, -0.2, 0],
      [-0.25, -0.8, 0],
    ]),
    tattered(c, [half + 0.1, -half - 0.1, z0], 22 + level * 3),
    cryptBlock(c, 'plinth', {
      size: 1.4,
      z: 0,
      height: z0,
      colour: shade(UNDEAD.stone, 0.8),
    }),
  ];
  if (level >= 2)
    parts.push(
      cryptBlock(c, 'lower', { size, z: z0, height: gz - 2 - z0 }),
      prism(c, {
        footprintW: g * 2,
        footprintD: g * 2,
        z: gz - 2,
        height: 2,
        palette: faces(UNDEAD.slate, 1.3),
        ao: false,
      }),
      railing(c, [-g, -g], [g, -g], gz, 5, 6, UNDEAD.iron),
      railing(c, [-g, -g], [-g, g], gz, 5, 6, UNDEAD.iron),
    );
  parts.push(
    cryptBlock(c, 'body', { size, z: gz, height: top - gz }),
    onFace(c.o, upper, 'left', window),
    onFace(c.o, upper, 'right', (w) =>
      path(gothicArchD(w / 2 - 1.5, 7, 3, Math.min(10, winH - 2)), {
        fill: shade(UNDEAD.soul, 0.55),
      }),
    ),
  );
  // Bone trim along the front top edges.
  const L = at(c, [-half, half, top - 1]);
  const F = at(c, [half, half, top - 1]);
  const R = at(c, [half, -half, top - 1]);
  parts.push(
    bone(L, F, 1, UNDEAD.bone),
    bone(F, R, 1, shade(UNDEAD.bone, 0.8)),
    skull(at(c, [-0.05, half, top - 4]), 0.55, UNDEAD.bone),
  );
  if (level >= 2)
    parts.push(
      railing(c, [-g, g], [g, g], gz, 5, 6, UNDEAD.iron),
      railing(c, [g, g], [g, -g], gz, 5, 6, UNDEAD.iron),
    );
  parts.push(
    pyramidRoof(c, {
      footprintW: size + 0.4,
      footprintD: size + 0.4,
      z: top,
      height: roofH,
      palette: faces(UNDEAD.slate, 1.3),
      rows: 3,
    }),
    finial(at(c, [0, 0, top + roofH]), 7),
  );
  if (level >= 3) {
    // Corner pinnacles and soul-fire braziers.
    for (const [x, y] of [
      [-half - 0.12, half + 0.12],
      [half + 0.12, -half - 0.12],
    ] as const) {
      const p = at(c, [x, y, top]);
      parts.push(spike(p, 9, 2.6, 0, UNDEAD.slate));
    }
    parts.push(
      brazier(c, at(c, [-0.62, 0.62, 4]), 1.8, UNDEAD.soul, UNDEAD.iron),
      brazier(c, at(c, [0.62, 0.62, 4]), 1.8, UNDEAD.soul, UNDEAD.iron),
    );
  }
  return finishTower(c, parts);
}

/** Banshee: bone ribcage on a gothic pedestal holding a spectral wisp; more wisps orbit with each level. */
function banshee(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'undead-banshee',
    params,
    [96, 104, 112][level - 1] ?? 112,
  );
  const pedH = 12;
  const z0 = 3 + pedH;
  const cageH = 26 + 4 * level;
  const z1 = z0 + cageH;
  const ribs = 7;
  const back: string[] = [];
  const front: string[] = [];
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2 + 0.3;
    const p0 = at(c, [Math.cos(a) * 0.36, Math.sin(a) * 0.36, z0]);
    const pc = at(c, [
      Math.cos(a) * 0.62,
      Math.sin(a) * 0.62,
      z0 + cageH * 0.55,
    ]);
    const p1 = at(c, [Math.cos(a) * 0.1, Math.sin(a) * 0.1, z1]);
    const dd = `M${num(p0[0])} ${num(p0[1])} Q${num(pc[0])} ${num(pc[1])} ${num(p1[0])} ${num(p1[1])}`;
    const isFront = Math.cos(a) + Math.sin(a) > 0;
    const colour =
      Math.cos(a) - Math.sin(a) < 0 ? UNDEAD.bone : shade(UNDEAD.bone, 0.72);
    (isFront ? front : back).push(
      path(dd, {
        fill: 'none',
        stroke: shade(UNDEAD.bone, 0.35),
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
      }),
      path(dd, {
        fill: 'none',
        stroke: isFront ? colour : shade(colour, 0.7),
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
      }),
    );
  }
  const heart = at(c, [0, 0, z0 + cageH * 0.45]);
  const ped = box(0, 0, 0.92, 0.92, 3, pedH);
  const orbiters = Array.from({ length: level - 1 }, (_, i) => {
    const a = i === 0 ? 2.6 : -0.4;
    const e = groundEllipse(c.o, 0, 0, z0 + cageH * (0.3 + 0.35 * i), 0.82);
    return wisp(
      c,
      [e.x + Math.cos(a) * e.rx, e.y + Math.sin(a) * e.ry],
      2.2,
      UNDEAD.spectre,
      i === 0 ? 1 : -1,
    );
  });
  const ring = ringHalves(groundEllipse(c.o, 0, 0, z0 + cageH * 0.4, 0.82));
  return finishTower(
    c,
    towerShadow(c),
    graveyard(c, 0.92, [
      [-0.7, 0.2, 0],
      [0.15, -0.8, 0],
    ]),
    cryptBlock(c, 'plinth', {
      size: 1.4,
      z: 0,
      height: 3,
      colour: shade(UNDEAD.stone, 0.8),
    }),
    cryptBlock(c, 'ped', { size: 0.92, z: 3, height: pedH }),
    onFace(c.o, ped, 'left', (w) =>
      path(gothicArchD(w / 2 - 2.5, 2.5, 5, pedH - 4), {
        fill: shade(UNDEAD.stone, 0.45),
      }),
    ),
    onFace(c.o, ped, 'right', (w) =>
      path(gothicArchD(w / 2 - 2.5, 2.5, 5, pedH - 4), {
        fill: shade(UNDEAD.stone, 0.4),
      }),
    ),
    tattered(c, [-0.46, -0.46, 3 + pedH], 18 + level * 3),
    level >= 2
      ? path(ring.back, {
          fill: 'none',
          stroke: UNDEAD.spectre,
          'stroke-opacity': 0.3,
          'stroke-width': 0.8,
          'stroke-dasharray': '2 2',
        })
      : '',
    back,
    glow(c, heart, 11 + level, UNDEAD.soul, 0.45),
    wisp(c, [heart[0], heart[1] - 3], 3.2 + level * 0.3, UNDEAD.spectre, 1),
    front,
    skull(at(c, [0, 0, z1 + 2]), 0.9, UNDEAD.bone),
    level >= 2
      ? path(ring.front, {
          fill: 'none',
          stroke: UNDEAD.spectre,
          'stroke-opacity': 0.55,
          'stroke-width': 0.8,
          'stroke-dasharray': '2 2',
        })
      : '',
    orbiters,
    level >= 3
      ? [
          spike(at(c, [-0.46, 0.46, 3 + pedH]), 6, 2, -20, UNDEAD.iron),
          spike(at(c, [0.46, 0.46, 3 + pedH]), 7, 2, 0, UNDEAD.iron),
          spike(at(c, [0.46, -0.46, 3 + pedH]), 6, 2, 20, UNDEAD.iron),
        ]
      : '',
  );
}

/** Glowing rune strokes stacked on a face. */
function runes(count: number, colour: string, seed: string): FacePattern {
  return (w, h) => {
    const r = rng(seed);
    const out: string[] = [];
    const step = h / (count + 1);
    for (let i = 1; i <= count; i++) {
      const y = step * i;
      const x = w / 2;
      const glyph = r.int(0, 2);
      const dd =
        glyph === 0
          ? `M${num(x - 1.5)} ${num(y - 2)} L${num(x)} ${num(y + 2)} L${num(x + 1.5)} ${num(y - 2)}`
          : glyph === 1
            ? `M${num(x)} ${num(y - 2.2)} L${num(x)} ${num(y + 2.2)} M${num(x - 1.6)} ${num(y - 0.6)} L${num(x + 1.6)} ${num(y + 0.6)}`
            : `M${num(x - 1.4)} ${num(y + 2)} L${num(x - 1.4)} ${num(y - 2)} L${num(x + 1.4)} ${num(y)} L${num(x - 1.4)} ${num(y)}`;
      out.push(
        path(dd, {
          fill: 'none',
          stroke: colour,
          'stroke-width': 1.8,
          'stroke-opacity': 0.45,
        }),
        path(dd, {
          fill: 'none',
          stroke: mix(colour, '#ffffff', 0.4),
          'stroke-width': 0.7,
        }),
      );
    }
    return group({}, out);
  };
}

/** Lich: rune-carved obelisk under a floating phylactery; rune circle, spikes and a rune ring per level. */
function lich(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'undead-lich',
    params,
    [96, 104, 112][level - 1] ?? 112,
  );
  const s1 = 1.3;
  const s2 = 0.95;
  const obel = 0.56;
  const zO = 4 + 4;
  const obelH = 30 + 5 * level;
  const pyrZ = zO + obelH;
  const gem = at(c, [0, 0, pyrZ + 9 + 5 + level]);
  const runeCircle = groundEllipse(c.o, 0, 0, 0, 0.9);
  const ring = isoRing(c, 0, 0, zO + obelH * 0.5, 0.62, 0.8, UNDEAD.rune);
  const ob = box(0, 0, obel, obel, zO, obelH);
  const gemShape = (fill: string): string =>
    polygon(
      [
        [gem[0], gem[1] - 6],
        [gem[0] + 3.2, gem[1]],
        [gem[0], gem[1] + 6],
        [gem[0] - 3.2, gem[1]],
      ],
      { fill },
    );
  return finishTower(
    c,
    towerShadow(c),
    graveyard(c, 0.95, [
      [-0.8, -0.05, 0],
      [-0.1, -0.85, 0],
    ]),
    level >= 2
      ? group(
          {},
          ellipse(runeCircle.x, runeCircle.y, runeCircle.rx, runeCircle.ry, {
            fill: 'none',
            stroke: UNDEAD.rune,
            'stroke-width': 2,
            'stroke-opacity': 0.5,
            filter: c.defs.blur(1),
          }),
          ellipse(runeCircle.x, runeCircle.y, runeCircle.rx, runeCircle.ry, {
            fill: 'none',
            stroke: UNDEAD.rune,
            'stroke-width': 0.6,
            'stroke-dasharray': '3 1.5',
          }),
        )
      : '',
    cryptBlock(c, 's1', {
      size: s1,
      z: 0,
      height: 4,
      colour: shade(UNDEAD.stone, 0.8),
    }),
    cryptBlock(c, 's2', { size: s2, z: 4, height: 4 }),
    tattered(c, [-s1 / 2 + 0.08, -s1 / 2 + 0.08, 4], 20 + level * 3),
    level >= 3 ? ring.back : '',
    prism(c, {
      footprintW: obel,
      footprintD: obel,
      z: zO,
      height: obelH,
      palette: faces(shade(UNDEAD.stone, 0.85), 1.2),
    }),
    onFace(c.o, ob, 'left', runes(3 + level, UNDEAD.rune, `${c.seed}/rl`)),
    onFace(
      c.o,
      ob,
      'right',
      runes(3 + level, shade(UNDEAD.rune, 0.75), `${c.seed}/rr`),
    ),
    pyramidRoof(c, {
      footprintW: obel + 0.06,
      footprintD: obel + 0.06,
      z: pyrZ,
      height: 9,
      palette: faces(UNDEAD.slate, 1.3),
    }),
    level >= 3 ? ring.front : '',
    // Floating phylactery in a bone setting.
    glow(c, gem, 9 + level, UNDEAD.rune, 0.5),
    gemShape(
      c.defs.linear([
        [0, mix(UNDEAD.rune, '#ffffff', 0.6)],
        [0.5, UNDEAD.rune],
        [1, shade(UNDEAD.rune, 0.45)],
      ]),
    ),
    polygon(
      [
        [gem[0], gem[1] - 6],
        [gem[0] + 3.2, gem[1]],
        [gem[0], gem[1] + 6],
      ],
      { fill: '#000000', 'fill-opacity': 0.25 },
    ),
    ellipse(gem[0], gem[1] + 0.5, 4.8, 1.6, {
      fill: 'none',
      stroke: UNDEAD.bone,
      'stroke-width': 0.9,
    }),
    level >= 2
      ? [
          spike(at(c, [-s1 / 2, s1 / 2, 4]), 6, 2, -15, UNDEAD.iron),
          spike(at(c, [s1 / 2, s1 / 2, 4]), 7, 2, 0, UNDEAD.iron),
          spike(at(c, [s1 / 2, -s1 / 2, 4]), 6, 2, 15, UNDEAD.iron),
        ]
      : '',
    level >= 3
      ? [
          iceShard(
            c,
            { x: 0.62, y: 0.3, height: 9, width: 2.2, lean: 0.3 },
            0,
            UNDEAD.rune,
          ),
          skull(at(c, [-0.25, 0.62, 5.5]), 0.6, UNDEAD.bone),
        ]
      : '',
  );
}

/** Plague hurler: bone catapult with a skull cup of ooze and a bubbling cauldron; ribs, skulls and green fire per level. */
function plaguehurler(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'undead-plaguehurler',
    params,
    [80, 88, 96][level - 1] ?? 96,
  );
  const h = 5;
  const axleZ = h + 14 + level;
  const axleL = at(c, [0.1, 0.4, axleZ]);
  const axleR = at(c, [0.1, -0.4, axleZ]);
  const axle: Pt = [(axleL[0] + axleR[0]) / 2, (axleL[1] + axleR[1]) / 2];
  const armLen = 19 + level * 2;
  // Cocked toward the back-right (the orc catapult cocks to the left).
  const end: Pt = [axle[0] + armLen * 0.5, axle[1] - armLen * 0.82];
  const counter: Pt = [axle[0] - 6, axle[1] + 6];
  const blobR = 3 + level * 0.4;
  const blob: Pt = [end[0], end[1] - blobR];
  const upright = (y: number, top: Pt, colour: string): string =>
    group(
      {},
      bone(at(c, [-0.3, y, h]), top, 1.4, colour),
      bone(at(c, [0.5, y, h]), top, 1.4, colour),
    );
  // Cauldron at the front-left.
  const pot = at(c, [-0.25, 0.55, h]);
  const potR = 4.5 + level * 0.6;
  const team = TEAM_COLOURS[c.team];
  const cauldron = group(
    {},
    level >= 3
      ? brazier(c, [pot[0], pot[1] + 1], 1.4, UNDEAD.ooze, UNDEAD.iron)
      : '',
    path(
      `M${num(pot[0] - potR)} ${num(pot[1] - potR * 0.9)} Q${num(pot[0] - potR)} ${num(pot[1] + potR * 0.6)} ${num(pot[0])} ${num(pot[1] + potR * 0.6)} Q${num(pot[0] + potR)} ${num(pot[1] + potR * 0.6)} ${num(pot[0] + potR)} ${num(pot[1] - potR * 0.9)} Z`,
      {
        fill: ballFill(c, UNDEAD.cauldron, 1.4),
        stroke: shade(UNDEAD.cauldron, 0.4),
        'stroke-width': 0.5,
      },
    ),
    rect(pot[0] - potR * 0.95, pot[1] - potR * 0.3, potR * 1.9, 1.4, {
      fill: team.main,
    }),
    ellipse(pot[0], pot[1] - potR * 0.9, potR, potR * 0.38, {
      fill: UNDEAD.ooze,
      stroke: shade(UNDEAD.cauldron, 1.4),
      'stroke-width': 0.6,
    }),
    circle(pot[0] - 1.5, pot[1] - potR * 0.95, 0.9, {
      fill: mix(UNDEAD.ooze, '#ffffff', 0.5),
    }),
    circle(pot[0] + 1.6, pot[1] - potR * 0.85, 0.6, {
      fill: mix(UNDEAD.ooze, '#ffffff', 0.5),
    }),
    smoke(
      c,
      [pot[0] + 1, pot[1] - potR * 0.9],
      2 + level,
      mix(UNDEAD.ooze, '#808080', 0.5),
    ),
  );
  return finishTower(
    c,
    towerShadow(c),
    graveyard(c, 0.95, [[-0.6, -0.6, 0]]),
    cryptBlock(c, 'deck', {
      size: 1.5,
      z: 0,
      height: h,
      colour: shade(UNDEAD.stone, 0.85),
    }),
    tattered(c, [-0.66, 0.66, h], 22),
    upright(-0.4, axleR, shade(UNDEAD.bone, 0.75)),
    bone(counter, end, 1.9, UNDEAD.bone),
    skull([counter[0] + 1, counter[1] + 1], 1, UNDEAD.bone),
    glow(c, blob, blobR * 2.2, UNDEAD.ooze, 0.5),
    circle(blob[0], blob[1], blobR, { fill: ballFill(c, UNDEAD.ooze, 1.4) }),
    skull([end[0], end[1] + 0.5], 0.8, UNDEAD.bone),
    upright(0.4, axleL, UNDEAD.bone),
    line(axleL, axleR, { stroke: UNDEAD.iron, 'stroke-width': 1.6 }),
    level >= 2
      ? [
          skull([axleL[0], axleL[1] - 2.4], 0.65, UNDEAD.bone),
          bone(at(c, [0.7, 0.75, h]), at(c, [0.7, 0.2, h]), 1, UNDEAD.bone),
        ]
      : '',
    cauldron,
    level >= 3
      ? [
          skull(at(c, [0.55, 0.62, h + 1.5]), 0.7, UNDEAD.bone),
          skull(at(c, [0.7, 0.45, h + 1.5]), 0.6, shade(UNDEAD.bone, 0.85)),
        ]
      : '',
  );
}

export const UNDEAD_TOWERS: FactionTowers = {
  single: skeletonarcher,
  pierce: banshee,
  slow: lich,
  burst: plaguehurler,
};

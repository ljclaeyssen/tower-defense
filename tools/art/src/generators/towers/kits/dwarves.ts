/**
 * Dwarves and gnomes: engineering. Granite footings, riveted iron plates, brass turrets and domes,
 * copper coils and pipes, gears, gauges, chimneys with smoke, glass tubes. Squat and sturdy.
 */
import {
  box,
  bricks,
  cylinder,
  faceTransform,
  groundEllipse,
  onFace,
  prism,
  ringHalves,
} from '../../../iso.js';
import type { Box } from '../../../iso.js';
import { DWARF, TEAM_COLOURS, faces, mix, shade } from '../../../palette.js';
import { rng } from '../../../random.js';
import {
  circle,
  ellipse,
  group,
  line,
  num,
  path,
  pathD,
  polygon,
  rect,
} from '../../../svg.js';
import type { Pt } from '../../../svg.js';
import type { Sprite, TowerParams } from '../../types.js';
import {
  at,
  ballFill,
  crateLines,
  dome,
  flame,
  gauge,
  gear,
  isoRing,
  lightning,
  pipe,
  plates,
  smoke,
  sparkle,
} from '../ornaments.js';
import {
  banner,
  finishTower,
  glow,
  teamBand,
  towerCanvas,
  towerShadow,
} from '../parts.js';
import type { TowerCanvas } from '../parts.js';
import type { FactionTowers } from './types.js';

const lvl = (p: TowerParams): number => Math.min(3, Math.max(1, p.level));

/** Flagstone apron around the building. */
function apron(c: TowerCanvas, radius: number): string {
  const e = groundEllipse(c.o, 0, 0, 0, radius);
  return group(
    {},
    ellipse(e.x, e.y, e.rx, e.ry, {
      fill: c.defs.radial([
        [0, shade(DWARF.granite, 0.75)],
        [0.85, shade(DWARF.granite, 0.6)],
        [1, shade(DWARF.granite, 0.5), 0.5],
      ]),
    }),
    line([e.x - e.rx * 0.7, e.y], [e.x + e.rx * 0.7, e.y], {
      stroke: shade(DWARF.granite, 0.4),
      'stroke-width': 0.4,
    }),
    line([e.x, e.y - e.ry * 0.7], [e.x, e.y + e.ry * 0.7], {
      stroke: shade(DWARF.granite, 0.4),
      'stroke-width': 0.4,
    }),
  );
}

/** Granite footing with big blocks. */
function granite(
  c: TowerCanvas,
  key: string,
  size: number,
  z: number,
  height: number,
): string {
  const pattern = (k: string) =>
    bricks({
      course: 4,
      brick: 10,
      mortar: shade(DWARF.granite, 0.4),
      jitter: 0.07,
      rng: rng(`${c.seed}/${k}`),
    });
  return prism(c, {
    footprintW: size,
    footprintD: size,
    z,
    height,
    palette: faces(DWARF.granite),
    left: pattern(`${key}l`),
    right: pattern(`${key}r`),
  });
}

/** Riveted iron-plated block. */
function plated(
  c: TowerCanvas,
  s: { size: number; z: number; height: number; cx?: number; cy?: number },
): string {
  return prism(c, {
    cx: s.cx,
    cy: s.cy,
    footprintW: s.size,
    footprintD: s.size,
    z: s.z,
    height: s.height,
    palette: faces(DWARF.plate, 1.15),
    left: plates(7, DWARF.plate),
    right: plates(7, shade(DWARF.plate, 0.7)),
  });
}

/** Brass band (thin ledge) around a block footprint. */
function brassBand(c: TowerCanvas, size: number, z: number): string {
  return prism(c, {
    footprintW: size,
    footprintD: size,
    z,
    height: 1.6,
    palette: faces(DWARF.brass, 1.2),
    ao: false,
    outline: 0.4,
  });
}

/** Horizontal gun slit with a warm glow on a face. */
function gunSlit(
  c: TowerCanvas,
  b: Box,
  face: 'left' | 'right',
  v: number,
): string {
  const { transform, w } = faceTransform(c.o, b, face);
  return group(
    { transform },
    rect(w * 0.2 - 0.5, v - 0.5, w * 0.6 + 1, 3, { fill: DWARF.brass }),
    rect(w * 0.2, v, w * 0.6, 2, { fill: '#1a1410' }),
    rect(w * 0.2, v + 1.2, w * 0.6, 0.8, {
      fill: DWARF.window,
      'fill-opacity': face === 'left' ? 0.9 : 0.6,
    }),
  );
}

/** Chimney (small iron stack) with smoke at a deck point. */
function chimney(
  c: TowerCanvas,
  x: number,
  y: number,
  z: number,
  h: number,
): string {
  return group(
    {},
    cylinder(c, {
      cx: x,
      cy: y,
      radius: 0.12,
      z,
      height: h,
      palette: faces(shade(DWARF.plate, 0.8)),
      rows: 1,
    }),
    ellipse(
      ...((): [number, number, number, number] => {
        const e = groundEllipse(c.o, x, y, z + h, 0.14);
        return [e.x, e.y, e.rx, e.ry];
      })(),
      { fill: '#1a1612', stroke: DWARF.brass, 'stroke-width': 0.5 },
    ),
    smoke(c, at(c, [x, y, z + h]), 4, DWARF.smoke),
  );
}

const dwarfBanner = (
  c: TowerCanvas,
  p: readonly [number, number, number],
  pole: number,
): string =>
  banner(c, p, pole, {
    style: 'square',
    flag: 0.8,
    pole: DWARF.brass,
    trim: DWARF.brass,
  });

/** Rifle tower: plated bunker with gun slits and a brass turret; chimneys, gauges, gears and more barrels per level. */
function rifletower(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'dwarf-rifletower',
    params,
    [82, 92, 102][level - 1] ?? 102,
  );
  const baseH = 7;
  const bodyH = 14 + 3 * level;
  const size = 1.36;
  const top = baseH + bodyH;
  const body = box(0, 0, size, size, baseH, bodyH);
  const tR = 0.38 + 0.03 * level;
  const turret = at(c, [0, 0, top + 6]);
  const barrels = Array.from({ length: level }, (_, i) => {
    const y = turret[1] + 1 - (i - (level - 1) / 2) * 2.2;
    const from: Pt = [turret[0] + 3, y];
    const to: Pt = [turret[0] + 15 + level, y - 2];
    return group(
      {},
      line(from, to, {
        stroke: '#1d1c20',
        'stroke-width': 2.2,
        'stroke-linecap': 'round',
      }),
      line(from, to, {
        stroke: '#4a4a52',
        'stroke-width': 1.2,
        'stroke-linecap': 'round',
      }),
      circle(to[0], to[1], 1.2, {
        fill: DWARF.brass,
        stroke: shade(DWARF.brass, 0.5),
        'stroke-width': 0.3,
      }),
    );
  });
  return finishTower(
    c,
    towerShadow(c),
    apron(c, 0.95),
    dwarfBanner(c, [-0.72, -0.72, baseH], 26 + level * 3),
    level >= 2 ? chimney(c, -0.38, -0.38, top, 9 + level) : '',
    granite(c, 'base', 1.64, 0, baseH),
    plated(c, { size, z: baseH, height: bodyH }),
    teamBand(c, body, 1.4, 1.6),
    gunSlit(c, body, 'left', bodyH * 0.5),
    gunSlit(c, body, 'right', bodyH * 0.5),
    level >= 2
      ? onFace(c.o, body, 'left', (w) =>
          gauge([w * 0.18, bodyH - 4], 2, DWARF.brass),
        )
      : '',
    level >= 3
      ? onFace(c.o, body, 'right', (w) =>
          gear(w * 0.78, bodyH - 4.5, 3.6, 8, DWARF.brass),
        )
      : '',
    brassBand(c, size + 0.06, top),
    cylinder(c, {
      radius: tR,
      z: top + 1.6,
      height: 4,
      palette: faces(DWARF.brass),
      rows: 0,
    }),
    dome(c, 0, 0, top + 5.6, tR, 6 + level, DWARF.brass),
    barrels,
    level >= 3
      ? [
          line(
            at(c, [-0.1, -0.1, top + 11 + level]),
            at(c, [-0.1, -0.1, top + 18 + level]),
            { stroke: DWARF.plate, 'stroke-width': 1 },
          ),
          circle(...at(c, [-0.1, -0.1, top + 18 + level]), 1.3, {
            fill: DWARF.glass,
            stroke: DWARF.brass,
            'stroke-width': 0.4,
          }),
        ]
      : '',
  );
}

/** Tesla coil: copper column wound with a coil, porcelain insulators, a crackling sphere; gears and glass tubes per level. */
function teslacoil(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'dwarf-teslacoil',
    params,
    [94, 104, 112][level - 1] ?? 112,
  );
  const baseH = 10;
  const insul = 1 + level;
  const insulZ = baseH;
  const colZ = insulZ + insul * 3;
  const colH = 26 + 5 * level;
  const topZ = colZ + colH;
  const base = box(0, 0, 1.2, 1.2, 0, baseH);
  const turns = 5 + 2 * level;
  const coilBack: string[] = [];
  const coilFront: string[] = [];
  for (let i = 0; i < turns; i++) {
    const z = colZ + 3 + (i * (colH - 8)) / (turns - 1);
    const h = ringHalves(groundEllipse(c.o, 0, 0, z, 0.32));
    coilBack.push(
      path(h.back, {
        fill: 'none',
        stroke: shade(DWARF.copper, 0.55),
        'stroke-width': 1.3,
      }),
    );
    coilFront.push(
      path(h.front, {
        fill: 'none',
        stroke: shade(DWARF.copper, 0.45),
        'stroke-width': 1.7,
      }),
      path(h.front, {
        fill: 'none',
        stroke: DWARF.copper,
        'stroke-width': 1.1,
      }),
      path(h.front, {
        fill: 'none',
        stroke: shade(DWARF.copper, 1.5),
        'stroke-width': 0.35,
        transform: 'translate(-0.6 -0.3)',
      }),
    );
  }
  const insulators = Array.from({ length: insul }, (_, i) =>
    cylinder(c, {
      radius: 0.34 - i * 0.03,
      z: insulZ + i * 3,
      height: 2,
      palette: faces(DWARF.porcelain),
      rows: 0,
    }),
  );
  const torus = isoRing(c, 0, 0, topZ + 2, 0.42, 2.4, DWARF.copper);
  const sphereAt = at(c, [0, 0, topZ + 7]);
  const sr = 4 + level * 0.5;
  const arcs = [
    [-15, -4],
    [14, -7],
    [-11, 9],
    [12, 7],
  ]
    .slice(0, 1 + level)
    .map(([dx, dy], i) =>
      lightning(
        c,
        sphereAt,
        [sphereAt[0] + (dx ?? 0), sphereAt[1] + (dy ?? 0)],
        DWARF.spark,
        `${c.seed}/arc${i}`,
        4,
      ),
    );
  const tubes =
    level >= 3
      ? [-1, 1].map((side) => {
          const p = at(c, [
            side < 0 ? -0.5 : 0.5,
            side < 0 ? 0.5 : -0.5,
            baseH,
          ]);
          return group(
            {},
            rect(p[0] - 1.6, p[1] - 9, 3.2, 9, {
              rx: 1.4,
              fill: DWARF.glass,
              'fill-opacity': 0.45,
              stroke: DWARF.brass,
              'stroke-width': 0.4,
            }),
            rect(p[0] - 1.1, p[1] - 5, 2.2, 4.6, { rx: 1, fill: DWARF.spark }),
            rect(p[0] - 1.8, p[1] - 10, 3.6, 1.4, { fill: DWARF.brass }),
          );
        })
      : [];
  return finishTower(
    c,
    towerShadow(c),
    apron(c, 0.9),
    dwarfBanner(c, [-0.6, -0.6, 0], 24 + level * 3),
    granite(c, 'base', 1.44, 0, 4),
    plated(c, { size: 1.2, z: 4, height: baseH - 4 }),
    teamBand(c, base, 4.5, 1.6),
    level >= 2
      ? onFace(c.o, box(0, 0, 1.2, 1.2, 4, baseH - 4), 'right', (w) =>
          gear(w * 0.5, 3, 2.6, 8, DWARF.brass),
        )
      : '',
    insulators,
    coilBack,
    cylinder(c, {
      radius: 0.2,
      z: colZ,
      height: colH,
      palette: faces(shade(DWARF.copper, 0.85)),
      rows: 0,
    }),
    coilFront,
    torus.back,
    cylinder(c, {
      radius: 0.16,
      z: topZ,
      height: 4,
      palette: faces(DWARF.brass),
      rows: 0,
    }),
    torus.front,
    glow(c, sphereAt, sr * 2.6, DWARF.spark, 0.45),
    circle(sphereAt[0], sphereAt[1], sr, {
      fill: ballFill(c, DWARF.copper, 1.7),
      stroke: shade(DWARF.copper, 0.45),
      'stroke-width': 0.5,
    }),
    arcs,
    tubes,
  );
}

/** Cryo sprayer: frost tanks feeding a brass nozzle that breathes cold mist; more tanks and icicles per level. */
function cryosprayer(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'dwarf-cryosprayer',
    params,
    [82, 92, 102][level - 1] ?? 102,
  );
  const deckH = 6;
  const team = TEAM_COLOURS[c.team];
  const tankH = 18 + 3 * level;
  const tankSpots: readonly (readonly [number, number])[] = [
    [-0.32, -0.32],
    [0.3, -0.42],
    [-0.42, 0.28],
  ];
  const tanks = tankSpots.slice(0, level).map(([x, y], i) => {
    const r = 0.27;
    const top = groundEllipse(c.o, x, y, deckH + tankH, r);
    const band = (z: number, colour: string): string => {
      const h = ringHalves(groundEllipse(c.o, x, y, z, r));
      return path(h.front, {
        fill: 'none',
        stroke: colour,
        'stroke-width': 1.6,
      });
    };
    return {
      depth: x + y,
      svg: group(
        {},
        cylinder(c, {
          cx: x,
          cy: y,
          radius: r,
          z: deckH,
          height: tankH,
          palette: faces(DWARF.tank),
          rows: 0,
        }),
        band(deckH + 3, DWARF.brass),
        band(deckH + tankH * 0.55, team.main),
        band(deckH + tankH - 2, DWARF.brass),
        dome(c, x, y, deckH + tankH, r, 3, DWARF.tank),
        circle(top.x, top.y - 3, 0.9, { fill: DWARF.brass }),
        i === 0
          ? gauge(
              at(c, [x - 0.05, y + r, deckH + tankH * 0.3]),
              1.8,
              DWARF.brass,
            )
          : '',
      ),
    };
  });
  const nozzleBase = at(c, [0.35, 0.3, deckH]);
  const nozzleTop: Pt = [nozzleBase[0] + 3, nozzleBase[1] - 22 - 2 * level];
  const tip: Pt = [nozzleTop[0] + 6, nozzleTop[1] - 3];
  // Pipes from each tank to the nozzle column.
  const pipes = tankSpots.slice(0, level).map(([x, y]) => {
    const from = at(c, [x + 0.2, y + 0.2, deckH + 6]);
    return pipe(
      [
        from,
        [from[0] + 3, from[1] + 1],
        [nozzleBase[0] - 1, nozzleBase[1] - 8],
      ],
      1.6,
      DWARF.copper,
    );
  });
  const icicles = (p: Pt, n: number): string[] =>
    Array.from({ length: n }, (_, i) =>
      polygon(
        [
          [p[0] + i * 2 - 0.8, p[1]],
          [p[0] + i * 2 + 0.8, p[1]],
          [p[0] + i * 2, p[1] + 2.5 + (i % 2) * 1.5],
        ],
        {
          fill: DWARF.frost,
          stroke: shade(DWARF.frost, 0.5),
          'stroke-width': 0.3,
        },
      ),
    );
  const mist = group(
    {},
    circle(tip[0] + 2, tip[1] - 1, 4 + level, {
      fill: DWARF.frost,
      'fill-opacity': 0.45,
      filter: c.defs.blur(1.6),
    }),
    circle(tip[0] + 5, tip[1] - 4, 2.5 + level * 0.6, {
      fill: '#ffffff',
      'fill-opacity': 0.55,
      filter: c.defs.blur(1),
    }),
    sparkle([tip[0] + 4, tip[1] + 2], 1.6, '#ffffff'),
  );
  const frost = groundEllipse(c.o, 0, 0, 0, 0.95);
  return finishTower(
    c,
    towerShadow(c),
    ellipse(frost.x, frost.y, frost.rx, frost.ry, {
      fill: DWARF.frost,
      'fill-opacity': 0.35,
      filter: c.defs.blur(1.5),
    }),
    apron(c, 0.85),
    dwarfBanner(c, [-0.7, -0.7, deckH], 22 + level * 3),
    granite(c, 'deck', 1.6, 0, 3),
    plated(c, { size: 1.5, z: 3, height: deckH - 3 }),
    tanks.sort((a, b) => a.depth - b.depth).map((t) => t.svg),
    pipes,
    pipe([nozzleBase, nozzleTop, tip], 2.4, DWARF.brass),
    polygon(
      [
        [tip[0] - 1, tip[1] - 2.5],
        [tip[0] + 3, tip[1] - 3],
        [tip[0] + 3, tip[1] + 2],
        [tip[0] - 0.5, tip[1] + 1.5],
      ],
      {
        fill: shade(DWARF.brass, 0.85),
        stroke: shade(DWARF.brass, 0.4),
        'stroke-width': 0.4,
      },
    ),
    glow(c, tip, 7 + level, c.kit.glow.slow, 0.4),
    mist,
    icicles([nozzleTop[0] - 1, nozzleTop[1] + 4], 2),
    level >= 2 ? icicles([nozzleBase[0] - 6, nozzleBase[1] - 8], 3) : '',
    level >= 3 ? icicles(at(c, [-0.7, 0.75, deckH]), 4) : '',
  );
}

/** Steel mortar barrel with brass bands standing on screen point p, tilted toward the front-right. */
function steelMortar(
  c: TowerCanvas,
  p: Pt,
  radius: number,
  length: number,
  bands: number,
): string {
  const steel = faces('#7d838c', 1.2);
  const fill = c.defs.linear([
    [0, mix(steel.left, steel.top, 0.5)],
    [0.3, steel.top],
    [0.65, steel.left],
    [1, steel.right],
  ]);
  const parts: string[] = [
    ellipse(0, 0, radius * 1.2, radius, {
      fill,
      stroke: steel.edge,
      'stroke-width': 0.5,
    }),
    path(
      pathD([
        [-radius, 0],
        [-radius, -length],
        [radius, -length],
        [radius, 0],
      ]),
      { fill, stroke: steel.edge, 'stroke-width': 0.5 },
    ),
  ];
  for (let i = 1; i <= bands; i++) {
    const by = (-length * i) / (bands + 1);
    parts.push(
      rect(-radius * 1.08, by - 1, radius * 2.16, 2, {
        fill: DWARF.brass,
        stroke: shade(DWARF.brass, 0.5),
        'stroke-width': 0.3,
      }),
    );
    for (const u of [-0.5, 0.2])
      parts.push(
        circle(radius * u, by, 0.4, { fill: shade(DWARF.brass, 1.5) }),
      );
  }
  parts.push(
    ellipse(0, -length, radius * 1.3, radius * 0.55, {
      fill: DWARF.brass,
      stroke: shade(DWARF.brass, 0.45),
      'stroke-width': 0.5,
    }),
    ellipse(0, -length, radius * 0.85, radius * 0.36, { fill: '#0b0a0a' }),
  );
  return group(
    { transform: `translate(${num(p[0])} ${num(p[1])}) rotate(32)` },
    parts,
  );
}

/** Mortar: steel mortar on a riveted gun deck with a gear wheel and ammo crates; more crates, gauges and smoke per level. */
function mortar(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas('dwarf-mortar', params, [74, 82, 92][level - 1] ?? 92);
  const footing = 5;
  const deckH = 6 + level;
  const top = footing + deckH;
  const deck = box(0, 0, 1.3, 1.3, footing, deckH);
  const crate = (x: number, y: number, z: number, s = 0.36): string =>
    group(
      {},
      prism(c, {
        cx: x,
        cy: y,
        footprintW: s,
        footprintD: s,
        z,
        height: 5,
        palette: faces(DWARF.crate),
        left: crateLines(DWARF.crate),
        right: crateLines(shade(DWARF.crate, 0.7)),
        ao: false,
      }),
    );
  const shells = (p: Pt): string =>
    group(
      {},
      [0, 1.8, 3.6].map((dx) =>
        group(
          {},
          rect(p[0] + dx - 0.7, p[1] - 3, 1.4, 3, { fill: DWARF.brass }),
          circle(p[0] + dx, p[1] - 3, 0.7, { fill: shade(DWARF.brass, 1.3) }),
        ),
      ),
    );
  const gearAt = at(c, [0.32, -0.32, top + 3]);
  return finishTower(
    c,
    towerShadow(c),
    apron(c, 0.95),
    dwarfBanner(c, [-0.62, -0.62, top], 18 + level * 2),
    level >= 3 ? chimney(c, 0.42, -0.5, top, 8) : '',
    granite(c, 'foot', 1.6, 0, footing),
    plated(c, { size: 1.3, z: footing, height: deckH }),
    teamBand(c, deck, 1.6, 1.6),
    level >= 2
      ? onFace(c.o, deck, 'left', (w) =>
          gauge([w * 0.8, deckH * 0.55], 1.8, DWARF.brass),
        )
      : '',
    brassBand(c, 1.36, top),
    cylinder(c, {
      radius: 0.36,
      z: top + 1.6,
      height: 3,
      palette: faces(shade(DWARF.plate, 0.9)),
      rows: 0,
    }),
    gear(gearAt[0] + 5, gearAt[1] - 1, 3.4 + level * 0.6, 9, DWARF.brass),
    steelMortar(
      c,
      at(c, [0, 0, top + 6]),
      4.6 + level * 0.6,
      9 + level * 2.2,
      1 + level,
    ),
    crate(-0.42, 0.42, top + 1.6),
    shells(at(c, [-0.55, 0.3, top + 6.6])),
    level >= 2 ? crate(-0.62, 0.62, 0, 0.42) : '',
    level >= 3
      ? [
          crate(-0.2, 0.75, 0, 0.36),
          flame(...at(c, [0.55, 0.55, top + 1.6]), 1.2, 3, DWARF.window),
        ]
      : '',
  );
}

export const DWARF_TOWERS: FactionTowers = {
  single: rifletower,
  pierce: teslacoil,
  slow: cryosprayer,
  burst: mortar,
};

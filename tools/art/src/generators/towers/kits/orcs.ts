/**
 * Orcs: brutal, tribal, squat and wide. Stacked logs, spiked palisades, stretched hides, iron
 * bands, bone totems with skulls and tusks, red war paint, braziers with embers.
 */
import { box, groundEllipse, onFace, planks, prism } from '../../../iso.js';
import type { Box, FacePattern } from '../../../iso.js';
import { ORC, TEAM_COLOURS, faces, mix, shade } from '../../../palette.js';
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
  beam,
  brazier,
  dome,
  flame,
  iceShard,
  logs,
  skull,
  spike,
  stakes,
  tusk,
} from '../ornaments.js';
import type { ShardSpec } from '../ornaments.js';
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

/** Trampled earth with a few stones: the orc camp ground. */
function camp(c: TowerCanvas, radius: number): string {
  const e = groundEllipse(c.o, 0, 0, 0, radius);
  const r = rng(`${c.seed}/camp`);
  const stones: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = r.range(0.2, Math.PI - 0.2) + Math.PI / 4;
    const p = at(c, [
      Math.cos(a) * radius * 0.85,
      Math.sin(a) * radius * 0.85,
      0,
    ]);
    stones.push(
      ellipse(p[0], p[1], r.range(1, 1.8), r.range(0.7, 1.1), {
        fill: shade(ORC.stone, r.range(0.8, 1.2)),
      }),
    );
  }
  return group(
    {},
    ellipse(e.x, e.y, e.rx, e.ry, {
      fill: c.defs.radial([
        [0, ORC.earth],
        [0.8, shade(ORC.earth, 0.8)],
        [1, shade(ORC.earth, 0.6), 0.6],
      ]),
    }),
    stones,
  );
}

/** Log-cabin block: logs stacked on both faces, plank top. */
function logBlock(
  c: TowerCanvas,
  s: {
    cx?: number;
    cy?: number;
    size: number;
    z: number;
    height: number;
    row?: number;
  },
): string {
  return prism(c, {
    cx: s.cx,
    cy: s.cy,
    footprintW: s.size,
    footprintD: s.size,
    z: s.z,
    height: s.height,
    palette: faces(ORC.log, 1.1),
    left: logs(s.row ?? 4, ORC.logEnd, 'start'),
    right: logs(s.row ?? 4, shade(ORC.logEnd, 0.75), 'end'),
    top: planks(3.5, shade(ORC.log, 0.6), 0.5),
  });
}

/** Red war-paint chevrons on a face. */
function warPaint(u: number, v: number, size: number): FacePattern {
  return () =>
    group(
      {},
      path(
        `M${num(u)} ${num(v)} L${num(u + size / 2)} ${num(v + size * 0.5)} L${num(u + size)} ${num(v)}`,
        {
          fill: 'none',
          stroke: ORC.paint,
          'stroke-width': 1.3,
          'stroke-linejoin': 'round',
        },
      ),
      path(
        `M${num(u)} ${num(v + size * 0.55)} L${num(u + size / 2)} ${num(v + size * 1.05)} L${num(u + size)} ${num(v + size * 0.55)}`,
        {
          fill: 'none',
          stroke: ORC.paint,
          'stroke-width': 1.3,
          'stroke-linejoin': 'round',
        },
      ),
    );
}

/** Iron band with rivets around a block, `y` px below its top. */
function ironBand(c: TowerCanvas, b: Box, y: number): string {
  return group(
    {},
    onFace(c.o, b, 'left', (w) =>
      group(
        {},
        rect(0, y, w, 2.2, { fill: ORC.iron }),
        circle(w * 0.3, y + 1.1, 0.5, { fill: shade(ORC.iron, 1.8) }),
        circle(w * 0.7, y + 1.1, 0.5, { fill: shade(ORC.iron, 1.8) }),
      ),
    ),
    onFace(c.o, b, 'right', (w) =>
      group(
        {},
        rect(0, y, w, 2.2, { fill: shade(ORC.iron, 0.7) }),
        circle(w * 0.5, y + 1.1, 0.5, { fill: shade(ORC.iron, 1.4) }),
      ),
    ),
  );
}

/** Skull on a sharpened stake at a ground/deck point. */
function skullPike(
  c: TowerCanvas,
  p: readonly [number, number, number],
  h: number,
): string {
  const base = at(c, p);
  return group(
    {},
    beam(base, [base[0], base[1] - h], 1.2, ORC.log),
    skull([base[0], base[1] - h - 1], 0.7, ORC.bone),
  );
}

/** Stretched hide between four screen corners (far-left, far-right, near-right, near-left). */
function hide(c: TowerCanvas, corners: readonly [Pt, Pt, Pt, Pt]): string {
  const [a, b, cc, dd] = corners;
  const mid = (p: Pt, q: Pt, k: number): Pt => {
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const cx = (a[0] + b[0] + cc[0] + dd[0]) / 4;
    const cy = (a[1] + b[1] + cc[1] + dd[1]) / 4;
    return [m[0] + (cx - m[0]) * k, m[1] + (cy - m[1]) * k];
  };
  const edge = (p: Pt, q: Pt): string => {
    const m = mid(p, q, 0.18);
    return `Q${num(m[0])} ${num(m[1])} ${num(q[0])} ${num(q[1])}`;
  };
  const dPath = `M${num(a[0])} ${num(a[1])} ${edge(a, b)} ${edge(b, cc)} ${edge(cc, dd)} ${edge(dd, a)} Z`;
  return group(
    {},
    path(dPath, {
      fill: c.defs.linear([
        [0, shade(ORC.hide, 1.2)],
        [0.6, ORC.hide],
        [1, shade(ORC.hide, 0.7)],
      ]),
      stroke: ORC.hideStitch,
      'stroke-width': 0.6,
    }),
    path(dPath, {
      fill: 'none',
      stroke: shade(ORC.hide, 1.4),
      'stroke-width': 0.4,
      'stroke-dasharray': '1 1.2',
      transform: 'translate(0 0.9)',
    }),
  );
}

/** Orc warrior holding a spear upright, standing on p. */
function orcFigure(c: TowerCanvas, p: Pt): string {
  const [x, y] = p;
  const team = TEAM_COLOURS[c.team];
  return group(
    {},
    line([x - 1.3, y], [x - 1, y - 3.5], {
      stroke: ORC.leather,
      'stroke-width': 1.4,
    }),
    line([x + 1.3, y], [x + 1, y - 3.5], {
      stroke: shade(ORC.leather, 0.7),
      'stroke-width': 1.4,
    }),
    polygon(
      [
        [x - 3, y - 3.2],
        [x + 3, y - 3.2],
        [x + 3.4, y - 8.4],
        [x - 3.4, y - 8.4],
      ],
      { fill: ORC.skin, stroke: shade(ORC.skin, 0.4), 'stroke-width': 0.4 },
    ),
    rect(x - 3.1, y - 4.6, 6.2, 1.6, { fill: team.main }),
    polygon(
      [
        [x - 3.6, y - 8.4],
        [x - 1.5, y - 9.4],
        [x - 1.5, y - 7.4],
      ],
      { fill: ORC.iron },
    ),
    circle(x, y - 10, 1.9, {
      fill: ORC.skin,
      stroke: shade(ORC.skin, 0.4),
      'stroke-width': 0.4,
    }),
    circle(x - 0.7, y - 9.4, 0.3, { fill: '#ffffff' }),
    circle(x + 0.7, y - 9.4, 0.3, { fill: '#ffffff' }),
    line([x + 3.4, y - 1], [x + 4.6, y - 17], {
      stroke: ORC.log,
      'stroke-width': 0.9,
    }),
    polygon(
      [
        [x + 4.2, y - 16.6],
        [x + 4.9, y - 20.5],
        [x + 5.4, y - 16.3],
      ],
      { fill: '#c9ccd2', stroke: ORC.iron, 'stroke-width': 0.3 },
    ),
  );
}

/** Spear leaning from a ground point to a top point. */
function spear(a: Pt, b: Pt): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const tip: Pt = [b[0] + ux * 3.5, b[1] + uy * 3.5];
  return group(
    {},
    line(a, b, { stroke: shade(ORC.log, 0.8), 'stroke-width': 0.9 }),
    polygon(
      [[b[0] - uy * 1, b[1] + ux * 1], tip, [b[0] + uy * 1, b[1] - ux * 1]],
      { fill: '#c9ccd2', stroke: ORC.iron, 'stroke-width': 0.3 },
    ),
  );
}

/** Spear thrower: squat log watchtower with a palisade; hide awning, skulls and a brazier as it grows. */
function spearthrower(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'orc-spearthrower',
    params,
    [80, 94, 104][level - 1] ?? 104,
  );
  const size = 1.5;
  const h = 14 + 2 * level;
  const base = box(0, 0, size, size, 0, h);
  const half = size / 2 - 0.06;
  const pal = (
    from: [number, number],
    to: [number, number],
    key: string,
    n = 5,
  ): string => stakes(c, from, to, h, 6, n, ORC.log, `${c.seed}/${key}`);
  const parts: string[] = [
    towerShadow(c),
    camp(c, 0.95),
    logBlock(c, { size, z: 0, height: h }),
    // Spears leaning on the shaded side.
    ...[0, 1, 2].map((i) =>
      spear(
        at(c, [1.02, -0.5 + i * 0.3, 0]),
        at(c, [0.8, -0.58 + i * 0.3, h + 6]),
      ),
    ),
    onFace(c.o, base, 'left', warPaint(6, 4, 7)),
    level >= 3 ? ironBand(c, base, h - 5) : '',
    pal([-half, -half], [half, -half], 'back1'),
    pal([-half, -half], [-half, half], 'back2'),
    banner(c, [-half, -half, h + 2], level >= 2 ? 32 + level * 2 : 22, {
      style: 'square',
      flag: 0.85,
      pole: ORC.log,
      trim: ORC.bone,
    }),
  ];
  if (level >= 2) {
    // Hide awning on four poles, sloping toward the front.
    const poleTop = (x: number, y: number, z: number): Pt => at(c, [x, y, z]);
    const hi = h + 24;
    const lo = h + 17;
    for (const [x, y] of [
      [-half, -half],
      [half, -half],
    ] as const)
      parts.push(beam(at(c, [x, y, h]), poleTop(x, y, hi), 1.3, ORC.log));
    parts.push(
      hide(c, [
        poleTop(-half - 0.1, -half - 0.1, hi),
        poleTop(half + 0.1, -half - 0.1, hi),
        poleTop(half + 0.15, half + 0.15, lo),
        poleTop(-half - 0.15, half + 0.15, lo),
      ]),
    );
    parts.push(orcFigure(c, at(c, [0.05, 0.05, h])));
    for (const [x, y] of [
      [half, half],
      [-half, half],
      [half, -half],
    ] as const)
      parts.push(
        beam(
          at(c, [x, y, h]),
          poleTop(x, y, x + y > 0 ? lo : (hi + lo) / 2),
          1.3,
          ORC.log,
        ),
      );
    if (level >= 3) {
      const l = poleTop(-half - 0.15, half + 0.15, lo);
      const r = poleTop(half + 0.15, half + 0.15, lo);
      parts.push(
        tusk([l[0] + 1, l[1] + 1], 7, -1, ORC.bone),
        tusk([r[0] - 1, r[1] + 1], 7, 1, ORC.bone),
      );
    }
  } else parts.push(orcFigure(c, at(c, [0.05, 0.05, h])));
  parts.push(
    pal([half, -half], [half, half], 'front1'),
    pal([-half, half], [half, half], 'front2'),
  );
  if (level >= 2) parts.push(skullPike(c, [half, half, h], 9));
  if (level >= 3)
    parts.push(
      skullPike(c, [-half, half, h], 7),
      brazier(
        c,
        at(c, [half - 0.15, -half + 0.15, h + 2]),
        2,
        ORC.fire,
        ORC.iron,
      ),
    );
  return finishTower(c, parts);
}

/** Carved totem face pattern (variant 0..2) for a block face. */
function totemFace(variant: number, ember: boolean): FacePattern {
  return (w, h) => {
    const dark = '#2a1a10';
    const out: string[] = [
      path(
        `M${num(w * 0.1)} ${num(h * 0.3)} L${num(w * 0.5)} ${num(h * (variant === 1 ? 0.42 : 0.38))} L${num(w * 0.9)} ${num(h * 0.3)}`,
        {
          fill: 'none',
          stroke: dark,
          'stroke-width': 1.6,
        },
      ),
      ellipse(w * 0.3, h * 0.46, w * 0.11, h * 0.07, { fill: dark }),
      ellipse(w * 0.7, h * 0.46, w * 0.11, h * 0.07, { fill: dark }),
      rect(w * 0.44, h * 0.46, w * 0.12, h * 0.18, {
        fill: '#ffffff',
        'fill-opacity': 0.18,
      }),
      line([w * 0.12, h * 0.55], [w * 0.22, h * 0.66], {
        stroke: ORC.paint,
        'stroke-width': 1.1,
      }),
      line([w * 0.88, h * 0.55], [w * 0.78, h * 0.66], {
        stroke: ORC.paint,
        'stroke-width': 1.1,
      }),
    ];
    if (ember)
      out.push(
        circle(w * 0.3, h * 0.46, 0.6, { fill: ORC.ember }),
        circle(w * 0.7, h * 0.46, 0.6, { fill: ORC.ember }),
      );
    if (variant === 2)
      out.push(ellipse(w * 0.5, h * 0.78, w * 0.16, h * 0.1, { fill: dark }));
    else {
      out.push(rect(w * 0.18, h * 0.7, w * 0.64, h * 0.14, { fill: dark }));
      for (const u of [0.26, 0.74])
        out.push(
          polygon(
            [
              [w * (u - 0.05), h * 0.84],
              [w * u, h * 0.68],
              [w * (u + 0.05), h * 0.84],
            ],
            { fill: ORC.bone },
          ),
        );
    }
    return group({}, out);
  };
}

/** Dust totem: three carved faces stacked, feathers, a dust swirl on top; wings, horns and fetishes per level. */
function dusttotem(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'orc-dusttotem',
    params,
    [92, 102, 112][level - 1] ?? 112,
  );
  const segH = 12 + 2 * level;
  const size = 0.64;
  const baseH = 5;
  const parts: string[] = [
    towerShadow(c),
    camp(c, 0.85),
    logBlock(c, { size: 1.1, z: 0, height: baseH, row: 2.5 }),
  ];
  let z = baseH;
  const woods = [ORC.log, mix(ORC.log, ORC.paint, 0.25), shade(ORC.log, 1.15)];
  for (let i = 0; i < 3; i++) {
    const colour = woods[i] ?? ORC.log;
    parts.push(
      prism(c, {
        footprintW: size + 0.08,
        footprintD: size + 0.08,
        z,
        height: 1.6,
        palette: faces(shade(ORC.log, 0.7)),
        ao: false,
      }),
      prism(c, {
        footprintW: size,
        footprintD: size,
        z: z + 1.6,
        height: segH - 1.6,
        palette: faces(colour, 1.1),
      }),
      onFace(
        c.o,
        box(0, 0, size, size, z + 1.6, segH - 1.6),
        'left',
        totemFace(i, i === 2),
      ),
      onFace(
        c.o,
        box(0, 0, size, size, z + 1.6, segH - 1.6),
        'right',
        totemFace((i + 1) % 3, false),
      ),
    );
    if (i === 2 && level >= 2) {
      // Painted wings sticking out of the top face.
      const l = at(c, [-size / 2, size / 2, z + segH - 4]);
      const r = at(c, [size / 2, -size / 2, z + segH - 4]);
      parts.push(
        polygon(
          [l, [l[0] - 9, l[1] - 7], [l[0] - 8, l[1] - 1], [l[0] - 2, l[1] + 3]],
          {
            fill: shade(ORC.log, 1.2),
            stroke: shade(ORC.log, 0.4),
            'stroke-width': 0.4,
          },
        ),
        line([l[0] - 2, l[1] - 1], [l[0] - 8, l[1] - 5], {
          stroke: ORC.paint,
          'stroke-width': 1,
        }),
        polygon(
          [r, [r[0] + 9, r[1] - 7], [r[0] + 8, r[1] - 1], [r[0] + 2, r[1] + 3]],
          {
            fill: shade(ORC.log, 0.7),
            stroke: shade(ORC.log, 0.4),
            'stroke-width': 0.4,
          },
        ),
        line([r[0] + 2, r[1] - 1], [r[0] + 8, r[1] - 5], {
          stroke: ORC.paint,
          'stroke-width': 1,
        }),
      );
    }
    z += segH;
  }
  const top = at(c, [0, 0, z]);
  // Feathers fanning from the top.
  const feathers = [-40, -20, 0, 20, 40]
    .slice(level >= 2 ? 0 : 1, level >= 2 ? 5 : 4)
    .map((deg, i) =>
      group(
        { transform: `rotate(${deg} ${num(top[0])} ${num(top[1])})` },
        path(
          `M${num(top[0])} ${num(top[1])} Q${num(top[0] - 1.6)} ${num(top[1] - 5)} ${num(top[0])} ${num(top[1] - 9)} Q${num(top[0] + 1.6)} ${num(top[1] - 5)} ${num(top[0])} ${num(top[1])} Z`,
          {
            fill: i % 2 ? ORC.feather : ORC.paint,
            stroke: shade(ORC.feather, 0.5),
            'stroke-width': 0.3,
          },
        ),
      ),
    );
  const swirlAt: Pt = [top[0], top[1] - 14 - level];
  const swirl: string[] = [
    circle(swirlAt[0], swirlAt[1], 6 + level, {
      fill: ORC.dust,
      'fill-opacity': 0.35,
      filter: c.defs.blur(1.6),
    }),
  ];
  for (let i = 0; i < 3; i++) {
    const rx = 3 + i * 2 + level;
    swirl.push(
      ellipse(swirlAt[0], swirlAt[1] + i * 2 - 2, rx, rx * 0.35, {
        fill: 'none',
        stroke: shade(ORC.dust, 1.2 - i * 0.15),
        'stroke-width': 1.1,
        'stroke-dasharray': `${num(rx * 1.6)} ${num(rx * 0.8)}`,
        transform: `rotate(${-8 + i * 8} ${num(swirlAt[0])} ${num(swirlAt[1])})`,
      }),
    );
  }
  parts.push(
    banner(c, [0.42, -0.42, baseH], 16, {
      style: 'square',
      flag: 0.8,
      pole: ORC.log,
      trim: ORC.bone,
    }),
    ...feathers,
    ...swirl,
  );
  if (level >= 3) {
    const t = at(c, [0, 0, z]);
    parts.push(
      tusk([t[0] - 4, t[1] + 1], 8, -1, ORC.bone),
      tusk([t[0] + 4, t[1] + 1], 8, 1, ORC.bone),
    );
    const hang = at(c, [-size / 2, size / 2, baseH + segH * 2]);
    parts.push(
      line(hang, [hang[0] - 2, hang[1] + 6], {
        stroke: ORC.hideStitch,
        'stroke-width': 0.4,
      }),
      skull([hang[0] - 2, hang[1] + 7.5], 0.55, ORC.bone),
    );
  }
  return finishTower(c, parts);
}

/** Ice troll: crooked hide-and-log hut, ice spikes bursting out; a frozen trophy and tusks as it grows. */
function icetroll(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas(
    'orc-icetroll',
    params,
    [78, 88, 100][level - 1] ?? 100,
  );
  const domeH = 16 + 3 * level;
  const radius = 0.78;
  const apex = at(c, [0, 0, domeH]);
  const shards: ShardSpec[] = [
    { x: 0.75, y: -0.35, height: 9 + 3 * level, width: 2.6, lean: 0.35 },
    { x: -0.35, y: 0.78, height: 8 + 2 * level, width: 2.4, lean: -0.35 },
    { x: 0.6, y: 0.55, height: 7 + 2 * level, width: 2.2, lean: 0.2 },
    ...(level >= 2
      ? [
          { x: -0.75, y: -0.2, height: 11, width: 2.6, lean: -0.4 },
          { x: 0.15, y: 0.85, height: 6, width: 2, lean: 0.1 },
        ]
      : []),
    ...(level >= 3
      ? [
          { x: 0.85, y: 0.15, height: 12, width: 2.8, lean: 0.5 },
          { x: -0.1, y: -0.8, height: 13, width: 2.8, lean: 0.05 },
        ]
      : []),
  ];
  const back = shards.filter((s) => s.x + s.y < 0);
  const front = shards
    .filter((s) => s.x + s.y >= 0)
    .sort((a, b) => a.x + a.y - (b.x + b.y));
  const e = groundEllipse(c.o, 0, 0, 0, radius);
  const snow = groundEllipse(c.o, 0, 0, 0, 0.92);
  // Seams of the hide dome and the crossed poles poking out of the top.
  const seams = [-0.55, 0, 0.55].map((k) =>
    path(
      `M${num(e.x + e.rx * k)} ${num(e.y + e.ry * Math.sqrt(1 - k * k))} Q${num(e.x + e.rx * k * 0.9)} ${num(apex[1] + domeH * 0.3)} ${num(apex[0])} ${num(apex[1])}`,
      {
        fill: 'none',
        stroke: ORC.hideStitch,
        'stroke-width': 0.5,
        'stroke-dasharray': '1.2 0.8',
      },
    ),
  );
  const door = at(c, [0.1, 0.62, 0]);
  const parts: string[] = [
    towerShadow(c),
    ellipse(snow.x, snow.y, snow.rx, snow.ry, {
      fill: ORC.snow,
      'fill-opacity': 0.85,
    }),
    camp(c, 0.7),
    back.map((s) => iceShard(c, s, 0, ORC.ice)).join(''),
    banner(c, [-0.55, -0.55, 0], 26 + 3 * level, {
      style: 'square',
      flag: 0.85,
      pole: ORC.log,
      trim: ORC.bone,
    }),
    beam([apex[0] - 7, apex[1] + 4], [apex[0] + 4, apex[1] - 6], 1.4, ORC.log),
    dome(c, 0, 0, 0, radius, domeH, ORC.hide),
    ...seams,
    beam([apex[0] + 7, apex[1] + 4], [apex[0] - 4, apex[1] - 6], 1.4, ORC.log),
    // Door with a log lintel.
    path(
      `M${num(door[0] - 3.5)} ${num(door[1])} L${num(door[0] - 3.5)} ${num(door[1] - 6)} Q${num(door[0])} ${num(door[1] - 10)} ${num(door[0] + 3.5)} ${num(door[1] - 6)} L${num(door[0] + 3.5)} ${num(door[1])} Z`,
      { fill: '#1d140e' },
    ),
    beam(
      [door[0] - 4.5, door[1] - 7.5],
      [door[0] + 4.5, door[1] - 7.5],
      1.3,
      ORC.log,
    ),
    // Frost rime on the dome.
    path(
      `M${num(e.x - e.rx * 0.8)} ${num(apex[1] + domeH * 0.35)} Q${num(apex[0] - 2)} ${num(apex[1] - 1)} ${num(apex[0] + e.rx * 0.5)} ${num(apex[1] + domeH * 0.2)}`,
      {
        fill: 'none',
        stroke: ORC.snow,
        'stroke-width': 1.6,
        'stroke-opacity': 0.8,
        'stroke-linecap': 'round',
      },
    ),
  ];
  if (level >= 3)
    parts.push(
      tusk([door[0] - 5, door[1]], 8, -1, ORC.bone),
      tusk([door[0] + 5, door[1]], 8, 1, ORC.bone),
    );
  if (level >= 2) {
    // Frozen trophy: a skull locked in an ice block on a pole beside the hut.
    const base = at(c, [0.62, -0.62, 0]);
    const poleH = 24 + level * 3;
    const top: Pt = [base[0], base[1] - poleH];
    parts.push(
      beam(base, top, 1.3, ORC.log),
      polygon(
        [
          [top[0] - 4, top[1] - 1],
          [top[0] + 1, top[1] + 1.5],
          [top[0] + 4.5, top[1] - 1],
          [top[0] + 4.5, top[1] - 8],
          [top[0] - 0.5, top[1] - 10.5],
          [top[0] - 4, top[1] - 8],
        ],
        {
          fill: ORC.ice,
          'fill-opacity': 0.75,
          stroke: shade(ORC.ice, 0.5),
          'stroke-width': 0.5,
        },
      ),
      skull([top[0], top[1] - 4.5], 0.65, ORC.bone),
      polygon(
        [
          [top[0] + 1, top[1] + 1.5],
          [top[0] + 4.5, top[1] - 1],
          [top[0] + 4.5, top[1] - 8],
          [top[0] + 1, top[1] - 5.5],
        ],
        { fill: '#ffffff', 'fill-opacity': 0.25 },
      ),
      glow(c, [top[0], top[1] - 4], 6, c.kit.glow.slow, 0.3),
    );
  }
  parts.push(front.map((s) => iceShard(c, s, 0, ORC.ice)).join(''));
  return finishTower(c, parts);
}

/** Catapult: crude log catapult on a spiked frame with a boulder basket; skulls, iron and fire per level. */
function catapult(params: TowerParams): Sprite {
  const level = lvl(params);
  const c = towerCanvas('orc-catapult', params, [76, 84, 92][level - 1] ?? 92);
  const size = 1.44;
  const h = 7;
  const deck = box(0, 0, size, size, 0, h);
  const axleZ = h + 13 + level;
  const leftPost = (x: number): Pt => at(c, [x, 0.42, h]);
  const rightPost = (x: number): Pt => at(c, [x, -0.42, h]);
  const axleL = at(c, [0, 0.42, axleZ]);
  const axleR = at(c, [0, -0.42, axleZ]);
  const axle: Pt = [(axleL[0] + axleR[0]) / 2, (axleL[1] + axleR[1]) / 2];
  const armLen = 20 + level * 1.5;
  const end: Pt = [axle[0] - armLen * 0.72, axle[1] - armLen * 0.69];
  const counter: Pt = [axle[0] + 8, axle[1] + 6];
  const boulderR = 3.4 + level * 0.4;
  const boulder: Pt = [end[0] - 0.5, end[1] - boulderR + 0.5];
  const half = size / 2;
  const spikes: string[] = [];
  for (const [x, y, deg] of [
    [-half, half, -55],
    [half, half, 90],
    [half, -half, 55],
    [0, half, -20],
    [half, 0, 20],
  ] as const) {
    if (level < 2 && Math.abs(x) + Math.abs(y) < size * 0.9) continue;
    spikes.push(
      spike(at(c, [x, y, h * 0.5]), 5 + level, 2.2, deg, shade(ORC.log, 1.25)),
    );
  }
  const upright = (post: (x: number) => Pt, top: Pt, colour: string): string =>
    group(
      {},
      beam(post(-0.38), top, 1.8, colour),
      beam(post(0.38), top, 1.8, colour),
    );
  return finishTower(
    c,
    towerShadow(c),
    camp(c, 0.98),
    logBlock(c, { size, z: 0, height: h, row: 3.5 }),
    onFace(c.o, deck, 'right', warPaint(4, 1.5, 4)),
    level >= 3 ? ironBand(c, deck, 1) : '',
    banner(c, [-half + 0.1, -half + 0.1, h], 22, {
      style: 'square',
      flag: 0.85,
      pole: ORC.log,
      trim: ORC.bone,
    }),
    upright(rightPost, axleR, shade(ORC.log, 0.85)),
    // Throwing arm, cocked back, with a rope basket and a boulder.
    beam(counter, end, 2.2, ORC.log),
    rect(counter[0] - 3, counter[1] - 1, 6, 5, {
      fill: ORC.stone,
      stroke: shade(ORC.stone, 0.4),
      'stroke-width': 0.4,
      transform: `rotate(-20 ${num(counter[0])} ${num(counter[1])})`,
    }),
    path(
      `M${num(end[0] - 4.5)} ${num(end[1] - 1)} Q${num(end[0])} ${num(end[1] + 4)} ${num(end[0] + 4)} ${num(end[1] - 1.5)}`,
      { fill: 'none', stroke: ORC.hideStitch, 'stroke-width': 1.2 },
    ),
    level >= 3
      ? [
          glow(c, boulder, boulderR * 1.7, ORC.fire, 0.55),
          flame(boulder[0], boulder[1] - boulderR * 0.4, 2.6, 8, ORC.ember),
        ]
      : '',
    circle(boulder[0], boulder[1], boulderR, {
      fill: ballFill(c, ORC.stone),
      stroke: shade(ORC.stone, 0.35),
      'stroke-width': 0.5,
    }),
    upright(leftPost, axleL, ORC.log),
    beam(axleL, axleR, 1.6, ORC.iron),
    spikes,
    level >= 2 ? skull([axleL[0], axleL[1] - 2.5], 0.7, ORC.bone) : '',
    level >= 3 ? skull([axleR[0] + 0.5, axleR[1] - 2.5], 0.6, ORC.bone) : '',
  );
}

export const ORC_TOWERS: FactionTowers = {
  single: spearthrower,
  pierce: dusttotem,
  slow: icetroll,
  burst: catapult,
};

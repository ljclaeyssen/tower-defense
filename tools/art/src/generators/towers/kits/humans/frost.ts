/**
 * Slow tower: cluster of ice crystals on a stone base with a frost glow. More and taller shards per
 * level; level 3 adds floating sparkles.
 */
import { box, project } from '../../../../iso.js';
import { mix } from '../../../../palette.js';
import type { Sprite, TowerParams } from '../../../types.js';
import {
  auraEllipse,
  finishTower,
  glow,
  plinth,
  stoneBlock,
  teamBand,
  towerCanvas,
  towerShadow,
} from '../../parts.js';
import { iceShard, sparkle } from '../../ornaments.js';
import type { ShardSpec } from '../../ornaments.js';

const HEIGHTS = [80, 96, 112] as const;

const SHARDS: readonly (readonly ShardSpec[])[] = [
  [
    { x: 0, y: 0, height: 26, width: 5, lean: 0.02 },
    { x: -0.32, y: 0.12, height: 14, width: 3.6, lean: -0.3 },
    { x: 0.14, y: -0.32, height: 12, width: 3.2, lean: 0.3 },
  ],
  [
    { x: 0, y: 0, height: 36, width: 5.6, lean: 0.02 },
    { x: -0.34, y: 0.1, height: 20, width: 4, lean: -0.28 },
    { x: 0.12, y: -0.36, height: 18, width: 3.6, lean: 0.3 },
    { x: 0.3, y: 0.28, height: 12, width: 3.2, lean: 0.35 },
    { x: -0.2, y: -0.3, height: 14, width: 3, lean: -0.15 },
  ],
  [
    { x: 0, y: 0, height: 46, width: 6.2, lean: 0.02 },
    { x: -0.36, y: 0.1, height: 26, width: 4.4, lean: -0.26 },
    { x: 0.12, y: -0.38, height: 24, width: 4, lean: 0.28 },
    { x: 0.32, y: 0.3, height: 16, width: 3.4, lean: 0.38 },
    { x: -0.22, y: -0.32, height: 18, width: 3.2, lean: -0.15 },
    { x: -0.12, y: 0.4, height: 11, width: 2.8, lean: -0.42 },
    { x: 0.42, y: -0.08, height: 13, width: 3, lean: 0.5 },
  ],
];

export function generateFrostTower(params: TowerParams): Sprite {
  const level = Math.min(3, Math.max(1, params.level));
  const c = towerCanvas('frost', params, HEIGHTS[level - 1] ?? 112);
  const { kit } = c;
  const baseH = 10;
  const topZ = 4 + baseH;
  const base = box(0, 0, 1.44, 1.44, 4, baseH);
  const shards = [...(SHARDS[level - 1] ?? [])].sort(
    (a, b) => a.x + a.y - (b.x + b.y),
  );
  const main = shards.find((s) => s.x === 0 && s.y === 0);
  const centre = project(c.o, 0, 0, topZ + (main?.height ?? 20) * 0.45);
  const frost = kit.glow.slow;
  const sparkles =
    level >= 3
      ? [
          sparkle([centre[0] - 15, centre[1] - 10], 2.2, '#ffffff'),
          sparkle(
            [centre[0] + 14, centre[1] - 18],
            1.8,
            mix(frost, '#ffffff', 0.5),
          ),
          sparkle([centre[0] + 11, centre[1] + 6], 1.5, '#ffffff'),
          sparkle(
            [centre[0] - 9, centre[1] - 28],
            1.4,
            mix(frost, '#ffffff', 0.5),
          ),
        ]
      : [];
  return finishTower(
    c,
    auraEllipse(c, 0.85, frost, 0.18 + 0.06 * level),
    towerShadow(c),
    plinth(c),
    stoneBlock(c, 'base', { size: 1.44, z: 4, height: baseH }),
    teamBand(c, base, 1.5, 2),
    glow(c, centre, 10 + 3 * level, frost, 0.45),
    shards.map((s) => iceShard(c, s, topZ, kit.ice)),
    sparkles,
  );
}

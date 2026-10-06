import { FACTION_IDS, TOWER_ROLES } from '@td/shared';
import type { FactionId } from '@td/shared';
import { renderSprite } from '../../build.js';
import { TEAMS } from '../../palette.js';
import { TOWER_KITS, generateTower } from './index.js';

/**
 * Opaque-pixel mask (alpha > 50 %) of the superstructure of a tower frame: rows more than 14 px
 * above the anchor, so the shared 2×2 footprint and plinth do not dominate the comparison.
 */
function mask(
  faction: FactionId,
  role: (typeof TOWER_ROLES)[number],
  level: number,
): { bits: Uint8Array; w: number; h: number } {
  const img = renderSprite(
    generateTower(role, { faction, level, team: 'blue' }),
    1,
  );
  const bits = new Uint8Array(img.width * img.height);
  const limit = img.height - 16 - 14;
  for (let i = 0; i < bits.length; i++)
    bits[i] =
      Math.floor(i / img.width) < limit && (img.data[i * 4 + 3] ?? 0) > 128
        ? 1
        : 0;
  return { bits, w: img.width, h: img.height };
}

/** Intersection over union of two masks aligned on their anchors (bottom-aligned, same width). */
function iou(a: ReturnType<typeof mask>, b: ReturnType<typeof mask>): number {
  const h = Math.max(a.h, b.h);
  let inter = 0;
  let union = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < a.w; x++) {
      const ya = y - (h - a.h);
      const yb = y - (h - b.h);
      const pa = ya >= 0 ? (a.bits[ya * a.w + x] ?? 0) : 0;
      const pb = yb >= 0 ? (b.bits[yb * b.w + x] ?? 0) : 0;
      if (pa && pb) inter++;
      if (pa || pb) union++;
    }
  return union === 0 ? 1 : inter / union;
}

describe('faction kits', () => {
  it('every faction implements every role with its own generator', () => {
    for (const role of TOWER_ROLES) {
      const generators = FACTION_IDS.map((f) => TOWER_KITS[f][role]);
      expect(new Set(generators).size).toBe(FACTION_IDS.length);
    }
  });

  it('team only changes accents, not the silhouette', () => {
    for (const faction of FACTION_IDS) {
      const [blue, red] = TEAMS.map((team) =>
        generateTower('single', { faction, level: 2, team }),
      );
      expect(blue?.svg).not.toBe(red?.svg);
      expect(blue?.height).toBe(red?.height);
    }
  });

  it('factions have distinct silhouettes for the same role and level', () => {
    const scores: { pair: string; iou: number }[] = [];
    for (const role of TOWER_ROLES)
      for (let level = 1; level <= 3; level++) {
        const masks = FACTION_IDS.map((f) => mask(f, role, level));
        for (let i = 0; i < masks.length; i++)
          for (let j = i + 1; j < masks.length; j++) {
            const a = masks[i];
            const b = masks[j];
            if (a && b)
              scores.push({
                pair: `${role} L${level} ${FACTION_IDS[i]}/${FACTION_IDS[j]}`,
                iou: iou(a, b),
              });
          }
      }
    scores.sort((a, b) => b.iou - a.iou);
    if (process.env['IOU'])
      console.log(
        scores
          .slice(0, 12)
          .map((s) => `${s.pair} ${s.iou.toFixed(2)}`)
          .join('\n'),
      );
    // 2a reused one shape for every faction (overlap 1.0); identities must stay well apart.
    expect(scores.filter((s) => s.iou >= 0.8).map((s) => s.pair)).toEqual([]);
  });

  it('levels grow the silhouette', () => {
    for (const faction of FACTION_IDS)
      for (const role of TOWER_ROLES) {
        const areas = [1, 2, 3].map((level) =>
          mask(faction, role, level).bits.reduce((s, v) => s + v, 0),
        );
        expect(areas[2], `${faction} ${role}`).toBeGreaterThan(areas[0] ?? 0);
      }
  });
});

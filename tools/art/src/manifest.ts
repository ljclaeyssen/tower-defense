/**
 * Every atlas frame, enumerated from the shared data. Frame names are the contract with the
 * renderer: ground/<kind>, tower/<modelId>/<team>, projectile/<visualId>,
 * creep/<creepId>/walk/<0-3>, creep/<creepId>/shadow, fx/particle.
 */
import {
  CREEP_TYPE_IDS,
  FACTION_IDS,
  TOWERS,
  TOWER_TYPE_IDS,
  getFactionTowers,
} from '@td/shared';
import type { CreepTypeId } from '@td/shared';
import { BEETLE, WALK_FRAMES } from './generators/creeps/beetle.js';
import { GROUND_KINDS, generateGround } from './generators/ground.js';
import {
  generateParticle,
  generateProjectile,
} from './generators/projectiles.js';
import { generateTower } from './generators/towers/index.js';
import type { CreepGenerator, Sprite } from './generators/types.js';
import { TEAMS } from './palette.js';

export type FrameGroup = 'ground' | 'tower' | 'projectile' | 'creep' | 'fx';
export const FRAME_GROUPS: readonly FrameGroup[] = [
  'ground',
  'tower',
  'projectile',
  'creep',
  'fx',
];

export interface FrameEntry {
  readonly name: string;
  readonly group: FrameGroup;
  /** Short human label (contact sheet). */
  readonly label: string;
  /** Sub-group for the contact sheet layout (faction, creep id…). */
  readonly section: string;
  readonly generate: () => Sprite;
}

/** Creep generators by creep id: every creep of creeps.json must have one (type-checked). */
export const CREEP_GENERATORS: Readonly<Record<CreepTypeId, CreepGenerator>> = {
  beetle: BEETLE,
};

/** Unique projectile visual ids of towers.json, in tower order. */
export function projectileVisualIds(): string[] {
  const out = new Set<string>();
  for (const type of TOWER_TYPE_IDS)
    for (const level of TOWERS[type].levels) out.add(level.projectile.visual);
  return [...out];
}

export function buildManifest(): FrameEntry[] {
  const frames: FrameEntry[] = [];
  for (const kind of GROUND_KINDS)
    frames.push({
      name: `ground/${kind}`,
      group: 'ground',
      section: 'ground',
      label: kind,
      generate: () => generateGround(kind),
    });
  for (const faction of FACTION_IDS)
    for (const type of getFactionTowers(faction)) {
      const def = TOWERS[type];
      def.levels.forEach((level, i) => {
        for (const team of TEAMS)
          frames.push({
            name: `tower/${level.model}/${team}`,
            group: 'tower',
            section: faction,
            label: `${level.model} ${team}`,
            generate: () =>
              generateTower(def.role, { faction, level: i + 1, team }),
          });
      });
    }
  for (const visual of projectileVisualIds())
    frames.push({
      name: `projectile/${visual}`,
      group: 'projectile',
      section: 'projectile',
      label: visual,
      generate: () => generateProjectile(visual),
    });
  for (const creep of CREEP_TYPE_IDS) {
    const gen = CREEP_GENERATORS[creep];
    for (let frame = 0; frame < WALK_FRAMES; frame++)
      frames.push({
        name: `creep/${creep}/walk/${frame}`,
        group: 'creep',
        section: creep,
        label: `${creep} walk ${frame}`,
        generate: () => gen.walk({ frame }),
      });
    frames.push({
      name: `creep/${creep}/shadow`,
      group: 'creep',
      section: creep,
      label: `${creep} shadow`,
      generate: () => gen.shadow(),
    });
  }
  frames.push({
    name: 'fx/particle',
    group: 'fx',
    section: 'fx',
    label: 'particle',
    generate: generateParticle,
  });
  return frames;
}

/** Frames whose name starts with one of the prefixes (all when none). */
export function filterManifest(
  frames: readonly FrameEntry[],
  prefixes: readonly string[],
): FrameEntry[] {
  if (prefixes.length === 0) return [...frames];
  return frames.filter((f) => prefixes.some((p) => f.name.startsWith(p)));
}

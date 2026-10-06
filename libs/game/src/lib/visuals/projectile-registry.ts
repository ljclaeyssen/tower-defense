/**
 * Projectile visual registry (pure, no Phaser): the single place that knows how a projectile visual
 * key from the data (`ProjectileDef.visual`, "<shape>-<faction>", e.g. "swirl-elves") is drawn.
 * Phase 2 maps the same keys to atlas frames here.
 */
import { FACTIONS, TOWERS, TOWER_TYPE_IDS, isFactionId } from '@td/shared';
import { mixColor } from '../render-math.js';
import { parseHexColor } from './color.js';

export type ProjectileShape = 'arrow' | 'swirl' | 'shard' | 'boulder' | 'bolt';
export const PROJECTILE_SHAPES: readonly ProjectileShape[] = [
  'arrow',
  'swirl',
  'shard',
  'boulder',
  'bolt',
];

/**
 * Style of the pierce back-travel animation: `arc` = the projectile sprite hops from creep to creep
 * along a slight arc with a fading trail; `bolt` = a jagged lightning segment between the creeps.
 */
export type ChainStyle = 'arc' | 'bolt';

export interface ProjectileDescriptor {
  readonly shape: ProjectileShape;
  readonly color: number;
  /** Half size of the visual in logical px (arrow/bolt: half length). */
  readonly radiusPx: number;
  /** Pierce back-travel style (only used by pierce projectiles). */
  readonly chain: ChainStyle;
}

/** Hand-tuned descriptors by visual key; empty for now (everything is derived from the key). */
export const PROJECTILE_OVERRIDES: Readonly<
  Record<string, ProjectileDescriptor>
> = {};

/** Neutral magenta visual for unknown keys: visible, never throws at render time. */
export const MISSING_PROJECTILE: ProjectileDescriptor = {
  shape: 'swirl',
  color: 0xff33ff,
  radiusPx: 3,
  chain: 'arc',
};

const isShape = (s: string): s is ProjectileShape =>
  (PROJECTILE_SHAPES as readonly string[]).includes(s);

/** Shape colour, nudged toward the faction accent. */
const BASE: Readonly<
  Record<
    ProjectileShape,
    { color: number; accentMix: number; radiusPx: number; chain?: ChainStyle }
  >
> = {
  arrow: { color: 0xf5ecd0, accentMix: 0.35, radiusPx: 4 },
  swirl: { color: 0xe0f2ff, accentMix: 0.6, radiusPx: 3 },
  shard: { color: 0x9fd8ff, accentMix: 0.2, radiusPx: 3 },
  boulder: { color: 0x4a4038, accentMix: 0.15, radiusPx: 3.5 },
  // Electric blue spark, lightly tinted by the faction accent.
  bolt: { color: 0x8fd3ff, accentMix: 0.2, radiusPx: 4.5, chain: 'bolt' },
};

const cache = new Map<string, ProjectileDescriptor>();

export function resolveProjectile(visualId: string): ProjectileDescriptor {
  const override = PROJECTILE_OVERRIDES[visualId];
  if (override) return override;
  let descriptor = cache.get(visualId);
  if (!descriptor) {
    const dash = visualId.indexOf('-');
    const shape = dash > 0 ? visualId.slice(0, dash) : '';
    const faction = dash > 0 ? visualId.slice(dash + 1) : '';
    if (!isShape(shape) || !isFactionId(faction)) return MISSING_PROJECTILE;
    const base = BASE[shape];
    const accent = parseHexColor(FACTIONS[faction].color, base.color);
    descriptor = {
      shape,
      color: mixColor(base.color, accent, base.accentMix),
      radiusPx: base.radiusPx,
      chain: base.chain ?? 'arc',
    };
    cache.set(visualId, descriptor);
  }
  return descriptor;
}

/** Every projectile visual key of the data, without duplicates, in tower order. */
export function allProjectileVisualIds(): readonly string[] {
  const out = new Set<string>();
  for (const type of TOWER_TYPE_IDS)
    for (const level of TOWERS[type].levels) out.add(level.projectile.visual);
  return [...out];
}

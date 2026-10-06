/**
 * Projectile visual registry (pure, no Phaser): the single place that knows how a projectile visual
 * key from the data (`ProjectileDef.visual`, "<shape>-<faction>", e.g. "swirl-elves") is drawn.
 * Phase 2 maps the same keys to atlas frames here.
 */
import { FACTIONS, TOWERS, TOWER_TYPE_IDS, isFactionId } from '@td/shared';
import { mixColor } from '../render-math.js';
import { parseHexColor } from './color.js';

export type ProjectileShape =
  | 'arrow'
  | 'swirl'
  | 'shard'
  | 'boulder'
  | 'bolt'
  | 'tornado'
  | 'gust'
  | 'dust'
  | 'wail';
export const PROJECTILE_SHAPES: readonly ProjectileShape[] = [
  'arrow',
  'swirl',
  'shard',
  'boulder',
  'bolt',
  'tornado',
  'gust',
  'dust',
  'wail',
];

/**
 * Style of the pierce back-travel animation (one renderer per style in the scene):
 * - `arc`: the projectile sprite hops from creep to creep along a slight arc, leaving its `trail`;
 * - `bolt`: a jagged lightning segment between the creeps, spark on each victim;
 * - `streak`: a bright line stretching from creep to creep then fading, shedding particles;
 * - `ripple`: an expanding translucent ring at each victim plus a faint line between victims.
 */
export type ChainStyle = 'arc' | 'bolt' | 'streak' | 'ripple';

/** Trail left by a travelling chain sprite: fading copies, rotating copies, or dust puffs. */
export type ProjectileTrail = 'none' | 'fade' | 'spiral' | 'puff';

/** Extra effect at each chain victim when its hop arrives. */
export type ProjectileImpact = 'none' | 'ring';

export interface ProjectileDescriptor {
  readonly shape: ProjectileShape;
  readonly color: number;
  /** Half size of the visual in logical px (arrow/bolt/gust: half length). */
  readonly radiusPx: number;
  /** Pierce back-travel style (only used by pierce projectiles). */
  readonly chain: ChainStyle;
  /** Spin of the sprite in flight, rad/s (0 = none). */
  readonly spin: number;
  /** Align the sprite with its flight direction (ignored when spinning). */
  readonly orient: boolean;
  readonly trail: ProjectileTrail;
  readonly impact: ProjectileImpact;
  /** Fill-flash colour of the creeps it hits. */
  readonly hitFlash: number;
}

/** Hand-tuned descriptors by visual key; empty for now (everything is derived from the key). */
export const PROJECTILE_OVERRIDES: Readonly<
  Record<string, ProjectileDescriptor>
> = {};

const DEFAULTS = {
  chain: 'arc',
  spin: 0,
  orient: false,
  trail: 'fade',
  impact: 'none',
  hitFlash: 0xffffff,
} as const satisfies Partial<ProjectileDescriptor>;

/** Neutral magenta visual for unknown keys: visible, never throws at render time. */
export const MISSING_PROJECTILE: ProjectileDescriptor = {
  ...DEFAULTS,
  shape: 'swirl',
  color: 0xff33ff,
  radiusPx: 3,
};

const isShape = (s: string): s is ProjectileShape =>
  (PROJECTILE_SHAPES as readonly string[]).includes(s);

type ShapeBase = Partial<Omit<ProjectileDescriptor, 'shape' | 'color'>> & {
  /** Base colour, nudged toward the faction accent by `accentMix`. */
  readonly color: number;
  readonly accentMix: number;
  readonly radiusPx: number;
};

const TURN = Math.PI * 2;

const BASE: Readonly<Record<ProjectileShape, ShapeBase>> = {
  arrow: { color: 0xf5ecd0, accentMix: 0.35, radiusPx: 4, orient: true },
  // Generic pierce orb (also the missing fallback shape).
  swirl: { color: 0xe0f2ff, accentMix: 0.6, radiusPx: 3 },
  shard: { color: 0x9fd8ff, accentMix: 0.2, radiusPx: 3 },
  boulder: { color: 0x4a4038, accentMix: 0.15, radiusPx: 3.5 },
  // Electric blue spark, lightly tinted by the faction accent.
  bolt: {
    color: 0x8fd3ff,
    accentMix: 0.2,
    radiusPx: 4.5,
    chain: 'bolt',
    orient: true,
  },
  // Grey-white funnel spinning in flight, spiral trail.
  tornado: {
    color: 0xe4e4e0,
    accentMix: 0.1,
    radiusPx: 4.5,
    spin: 2 * TURN,
    trail: 'spiral',
  },
  // Pale green crescent wind blade.
  gust: {
    color: 0xd9f7c9,
    accentMix: 0.3,
    radiusPx: 4.5,
    chain: 'streak',
    orient: true,
    trail: 'none',
  },
  // Brown dust devil: dense swirl, dark core; puff trail and a dust ring at each victim.
  dust: {
    color: 0x8a6440,
    accentMix: 0.2,
    radiusPx: 4.5,
    spin: 1.5 * TURN,
    trail: 'puff',
    impact: 'ring',
  },
  // Translucent pale violet scream ring; violet flashes.
  wail: {
    color: 0xdccbff,
    accentMix: 0.3,
    radiusPx: 4.5,
    chain: 'ripple',
    trail: 'none',
    hitFlash: 0xb48cff,
  },
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
    const { accentMix, color, ...rest } = BASE[shape];
    const accent = parseHexColor(FACTIONS[faction].color, color);
    descriptor = {
      ...DEFAULTS,
      ...rest,
      shape,
      color: mixColor(color, accent, accentMix),
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

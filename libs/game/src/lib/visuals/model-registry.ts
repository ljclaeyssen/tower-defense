/**
 * Tower model registry (pure, no Phaser): the single place that knows how a model key from the data
 * (`TowerLevelDef.model`, e.g. "human-archer-2") becomes something drawable.
 *
 * Today every model is a procedural placeholder derived from the data: shape from the tower role,
 * height from the level, palette from the faction. Phase 2 maps the same keys to atlas frames here.
 */
import { FACTIONS, TOWERS, TOWER_TYPE_IDS, isFactionId } from '@td/shared';
import type { FactionId, TowerRole, TowerTypeId } from '@td/shared';
import { parseHexColor } from './color.js';

export type ModelShape = 'prism' | 'spire' | 'crystal' | 'mortar';

export interface ModelPalette {
  /** Top face (lightest). */
  readonly top: number;
  /** Left face (lit side). */
  readonly left: number;
  /** Right face (shadow side). */
  readonly right: number;
  /** Faction accent (orb, top inlay, rim). */
  readonly accent: number;
}

export interface ModelDescriptor {
  readonly shape: ModelShape;
  /** Height of the body above the ground, in logical px. */
  readonly heightPx: number;
  readonly palette: ModelPalette;
}

/**
 * Hand-tuned descriptors by model key. Empty for now: every model is derived from the data. An entry
 * here wins over the derivation (e.g. to give one level a special look before real art exists).
 */
export const MODEL_OVERRIDES: Readonly<Record<string, ModelDescriptor>> = {};

/** Neutral magenta model for unknown keys: visible, never throws at render time. */
export const MISSING_MODEL: ModelDescriptor = {
  shape: 'prism',
  heightPx: 18,
  palette: { top: 0xff66ff, left: 0xcc33cc, right: 0x881188, accent: 0xffffff },
};

export const SHAPE_BY_ROLE: Readonly<Record<TowerRole, ModelShape>> = {
  single: 'prism',
  pierce: 'spire',
  slow: 'crystal',
  burst: 'mortar',
};

/** Faction body palettes (accent comes from `FactionDef.color`). */
const FACTION_BODY: Readonly<Record<FactionId, Omit<ModelPalette, 'accent'>>> =
  {
    // Stone grey.
    humans: { top: 0xdcd8cf, left: 0xaba699, right: 0x76726a },
    // Pale green / white.
    elves: { top: 0xf2f8ec, left: 0xcfe2c4, right: 0x8fae86 },
    // Brown wood and leather.
    orcs: { top: 0xb07a4c, left: 0x8a5a36, right: 0x5c3920 },
    // Dark purple with a bone top.
    undead: { top: 0xe3d8bd, left: 0x5b4672, right: 0x382a4b },
    // Iron grey with bronze and copper tones.
    dwarves: { top: 0x8c8f94, left: 0xa67c52, right: 0x5c4a36 },
  };
const NEUTRAL_BODY: Omit<ModelPalette, 'accent'> = {
  top: 0xd4d4d8,
  left: 0xa1a1aa,
  right: 0x71717a,
};

/** Body height per shape for a 1-based level. */
const HEIGHT_BY_SHAPE: Readonly<Record<ModelShape, (level: number) => number>> =
  {
    prism: (level) => 10 + 8 * level,
    spire: (level) => 16 + 9 * level,
    crystal: (level) => 8 + 6 * level,
    mortar: (level) => 6 + 4 * level,
  };

export interface ModelEntry {
  readonly type: TowerTypeId;
  /** 1-based level. */
  readonly level: number;
}

let modelIndex: Map<string, ModelEntry> | null = null;

/** model key -> (tower, level), built once from TOWERS. */
function index(): Map<string, ModelEntry> {
  if (!modelIndex) {
    modelIndex = new Map();
    for (const type of TOWER_TYPE_IDS) {
      TOWERS[type].levels.forEach((def, i) => {
        if (!modelIndex?.has(def.model))
          modelIndex?.set(def.model, { type, level: i + 1 });
      });
    }
  }
  return modelIndex;
}

/** Every model key of the data, in tower then level order. */
export function allModelIds(): readonly string[] {
  return [...index().keys()];
}

/** Tower and level that use `modelId`, if any. */
export function findModel(modelId: string): ModelEntry | undefined {
  return index().get(modelId);
}

/** Model key of a tower level; falls back to the `<type>-<level>` convention for unknown levels. */
export function modelIdOf(type: TowerTypeId, level: number): string {
  return TOWERS[type]?.levels[level - 1]?.model ?? `${type}-${level}`;
}

export function factionPalette(faction: string): ModelPalette {
  if (!isFactionId(faction)) return { ...NEUTRAL_BODY, accent: 0xffffff };
  return {
    ...FACTION_BODY[faction],
    accent: parseHexColor(FACTIONS[faction].color, 0xffffff),
  };
}

const cache = new Map<string, ModelDescriptor>();

export function resolveModel(modelId: string): ModelDescriptor {
  const override = MODEL_OVERRIDES[modelId];
  if (override) return override;
  let descriptor = cache.get(modelId);
  if (!descriptor) {
    const entry = findModel(modelId);
    if (!entry) return MISSING_MODEL;
    const def = TOWERS[entry.type];
    const shape = SHAPE_BY_ROLE[def.role] ?? 'prism';
    descriptor = {
      shape,
      heightPx: HEIGHT_BY_SHAPE[shape](entry.level),
      palette: factionPalette(def.faction),
    };
    cache.set(modelId, descriptor);
  }
  return descriptor;
}

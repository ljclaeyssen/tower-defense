/**
 * Every colour of the art pipeline lives here: shading rules (light from the left), team colours,
 * glows, ground colours and the faction kits. Generators never hard-code a team colour.
 */
import { FACTIONS } from '@td/shared';
import type { FactionId, Team } from '@td/shared';

export type Hex = string;

export function parseHex(hex: Hex): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Invalid colour ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (v: number): string =>
  Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, '0');

export const toHex = (r: number, g: number, b: number): Hex =>
  `#${channel(r)}${channel(g)}${channel(b)}`;

/** Linear blend: t = 0 → a, t = 1 → b. */
export function mix(a: Hex, b: Hex, t: number): Hex {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Warm light and cool shadow: lit surfaces drift toward LIGHT_TINT, shaded ones toward SHADOW_TINT. */
export const LIGHT_TINT: Hex = '#fff6e2';
export const SHADOW_TINT: Hex = '#161427';

/** factor > 1 lightens (1.25 = 25 % toward the light tint), factor < 1 darkens. */
export function shade(colour: Hex, factor: number): Hex {
  if (factor >= 1) return mix(colour, LIGHT_TINT, Math.min(1, factor - 1));
  return mix(colour, SHADOW_TINT, Math.min(1, 1 - factor));
}

/**
 * Light comes from the left of the screen: the left (+y facing) face shows the base colour, the
 * right (+x facing) face is in shadow, the top is the lightest.
 */
export const FACE_LIGHT = { top: 1.24, left: 1.0, right: 0.62, edge: 0.32 };

export interface FaceColours {
  readonly top: Hex;
  readonly left: Hex;
  readonly right: Hex;
  /** Outline / crease colour. */
  readonly edge: Hex;
}

/** Face colours of a material; `contrast` scales the light/shadow spread (1 = default). */
export function faces(base: Hex, contrast = 1): FaceColours {
  const k = (f: number): number => 1 + (f - 1) * contrast;
  return {
    top: shade(base, k(FACE_LIGHT.top)),
    left: shade(base, k(FACE_LIGHT.left)),
    right: shade(base, k(FACE_LIGHT.right)),
    edge: shade(base, FACE_LIGHT.edge),
  };
}

export interface TeamColours {
  readonly main: Hex;
  readonly light: Hex;
  readonly dark: Hex;
}

export const TEAMS: readonly Team[] = ['blue', 'red'];

export const TEAM_COLOURS: Readonly<Record<Team, TeamColours>> = {
  blue: { main: '#3b82f6', light: '#93c5fd', dark: '#1e3a8a' },
  red: { main: '#ef4444', light: '#fca5a5', dark: '#7f1d1d' },
};

export const GLOWS = {
  arcane: '#c49bff',
  frost: '#a6ecff',
  lightning: '#cfeaff',
  poison: '#a8ff5e',
  fire: '#ffb04a',
  nature: '#b9ffb4',
  holy: '#fff0a8',
} as const satisfies Record<string, Hex>;
export type Glow = keyof typeof GLOWS;

export const GROUND = {
  grass: ['#4c7d3b', '#558a43'],
  grassBlade: { light: '#86b862', dark: '#355c29' },
  dirt: ['#8c6b40', '#7d5f37'],
  dirtEdge: '#3f2c17',
  pebble: '#b3a58c',
  rock: '#80858d',
  rune: { spawn: '#5dff8a', exit: '#ff4a4a' },
} as const;

/** Natural creep colours (team-less frames; the renderer tints when needed). */
export const CREEP = {
  shell: '#7d6b3a',
  belly: '#3a3020',
  legs: '#5c4a2a',
  eye: '#f2e6a0',
} as const;

/** Slime creep: translucent green jelly with a darker core. */
export const SLIME = {
  body: '#7ad65c',
  core: '#3f9a3a',
  rim: '#2b6a2a',
  eye: '#16240f',
} as const;

/** Small figures (archers) and dark metal parts shared by every faction. */
export const FIGURE = {
  skin: '#e2b48a',
  leather: '#5a3a22',
  bow: '#7a4a24',
  string: '#efe6cf',
} as const;
export const IRON = '#46484f';

/** Elves: pale marble, silver birch, layered foliage, moonlight. */
export const ELF = {
  marble: '#eef0e6',
  marbleVein: '#b9c4b4',
  bark: '#b8ab8a',
  birch: '#f2f1e6',
  leaf: '#8fd49a',
  leafTeal: '#58b8a2',
  leafDeep: '#2f7a62',
  moon: '#effff9',
  pool: '#7fe6e0',
  lantern: '#fff1a8',
  flowers: ['#f7b8d8', '#ffffff', '#c9b8ff'],
  earth: '#6b5a3c',
  moss: '#5f9a4f',
  gold: '#e8d48a',
} as const;

/** Orcs: rough logs, stretched hides, bone, iron, red war paint, embers. */
export const ORC = {
  log: '#7a5233',
  logEnd: '#c49a68',
  hide: '#b48552',
  hideStitch: '#4e3220',
  iron: '#4b4a4f',
  bone: '#e6dcc0',
  paint: '#c0352a',
  ember: '#ff8a2a',
  fire: '#ffc04a',
  earth: '#6e5236',
  dust: '#b48c5c',
  stone: '#7d6f62',
  feather: '#e8e0d0',
  ice: '#bfe8f6',
  skin: '#6f9a3a',
  leather: '#5a3a24',
  snow: '#e8f4fa',
} as const;

/** Undead: dark gothic stone, black iron, bone, soul-fire green, tattered violet cloth. */
export const UNDEAD = {
  stone: '#4f4a60',
  slate: '#3d3652',
  iron: '#2b2931',
  bone: '#e3d8bd',
  soul: '#7dff6a',
  rune: '#9effd8',
  grave: '#7d7b88',
  cauldron: '#2c3328',
  ooze: '#8cff4a',
  spectre: '#d8fff0',
  earth: '#3d3a33',
} as const;

/** Dwarves and gnomes: granite, riveted iron plates, brass, copper, glass, smoke. */
export const DWARF = {
  granite: '#7a7f88',
  plate: '#5f656e',
  brass: '#cfa64e',
  copper: '#c4733c',
  glass: '#c8ecff',
  smoke: '#9a9aa0',
  window: '#ffc864',
  crate: '#9a6a3a',
  tank: '#5b86a8',
  frost: '#c8f4ff',
  spark: '#bfe6ff',
  porcelain: '#eeeae0',
} as const;

export type RoofStyle = 'cone' | 'pyramid';

/** Materials and ornaments of a faction. Adding a faction = adding one entry here. */
export interface FactionKit {
  readonly id: FactionId;
  /** Faction accent (from factions.json). */
  readonly accent: Hex;
  readonly stone: Hex;
  /** Per-brick tint jitter (0..0.15). */
  readonly stoneJitter: number;
  readonly mortar: Hex;
  readonly wood: Hex;
  readonly metal: Hex;
  readonly roof: Hex;
  readonly roofStyle: RoofStyle;
  /** Ornament colour: string courses, rings, finials. */
  readonly trim: Hex;
  readonly ice: Hex;
  /** Glow of the pierce orb, the slow aura and the lit arrow slits. */
  readonly glow: {
    readonly pierce: Hex;
    readonly slow: Hex;
    readonly slit: Hex;
  };
}

const accentOf = (id: FactionId): Hex => FACTIONS[id].color;

export const KITS: Readonly<Record<FactionId, FactionKit>> = {
  // Grey-beige masonry, oak, slate roofs and gold trims.
  humans: {
    id: 'humans',
    accent: accentOf('humans'),
    stone: '#a8a294',
    stoneJitter: 0.08,
    mortar: '#5f594e',
    wood: '#8a5a33',
    metal: '#7a828c',
    roof: '#56637d',
    roofStyle: 'cone',
    trim: '#d9b45a',
    ice: '#bfe9ff',
    glow: { pierce: GLOWS.lightning, slow: GLOWS.frost, slit: GLOWS.holy },
  },
  // Pale marble, birch, green roofs, silver-green trims.
  elves: {
    id: 'elves',
    accent: accentOf('elves'),
    stone: '#dde3cf',
    stoneJitter: 0.05,
    mortar: '#9aa88c',
    wood: '#c4a26a',
    metal: '#b9c8b0',
    roof: '#3f7d4a',
    roofStyle: 'cone',
    trim: '#7fe08a',
    ice: '#c4fbe8',
    glow: { pierce: GLOWS.nature, slow: '#b7fff0', slit: GLOWS.nature },
  },
  // Red-brown rough rock, dark wood, hide roofs, rust trims.
  orcs: {
    id: 'orcs',
    accent: accentOf('orcs'),
    stone: '#8c6a4c',
    stoneJitter: 0.12,
    mortar: '#47301f',
    wood: '#6b4423',
    metal: '#5d5752',
    roof: '#8a4a2a',
    roofStyle: 'pyramid',
    trim: '#d9663c',
    ice: '#b5dff0',
    glow: { pierce: '#e8c98a', slow: GLOWS.frost, slit: GLOWS.fire },
  },
  // Dark violet stone, bone trims, sickly glows.
  undead: {
    id: 'undead',
    accent: accentOf('undead'),
    stone: '#5e5470',
    stoneJitter: 0.1,
    mortar: '#2b2438',
    wood: '#4d423c',
    metal: '#7d8a7b',
    roof: '#302640',
    roofStyle: 'cone',
    trim: '#e3d8bd',
    ice: '#c9c2ff',
    glow: { pierce: GLOWS.arcane, slow: '#c9b8ff', slit: GLOWS.poison },
  },
  // Iron-grey granite, bronze and copper, forge glow.
  dwarves: {
    id: 'dwarves',
    accent: accentOf('dwarves'),
    stone: '#7a7f88',
    stoneJitter: 0.06,
    mortar: '#4c4f55',
    wood: '#7a5230',
    metal: '#b87333',
    roof: '#6b4a2e',
    roofStyle: 'pyramid',
    trim: '#c78a3b',
    ice: '#b8e4ff',
    glow: { pierce: '#9fd8ff', slow: GLOWS.frost, slit: GLOWS.fire },
  },
};

/** Projectile base colours, nudged toward the faction accent by `accentMix` (mirrors the renderer). */
export const PROJECTILE_BASE = {
  arrow: { colour: '#f5ecd0', accentMix: 0.35 },
  swirl: { colour: '#e0f2ff', accentMix: 0.6 },
  shard: { colour: '#9fd8ff', accentMix: 0.2 },
  boulder: { colour: '#6a5d50', accentMix: 0.15 },
  bolt: { colour: '#8fd3ff', accentMix: 0.2 },
  tornado: { colour: '#e4e4e0', accentMix: 0.1 },
  gust: { colour: '#d9f7c9', accentMix: 0.3 },
  dust: { colour: '#8a6440', accentMix: 0.2 },
  wail: { colour: '#dccbff', accentMix: 0.3 },
} as const satisfies Record<string, { colour: Hex; accentMix: number }>;
export type ProjectileShape = keyof typeof PROJECTILE_BASE;
export const PROJECTILE_SHAPES = Object.keys(
  PROJECTILE_BASE,
) as readonly ProjectileShape[];

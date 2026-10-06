/**
 * Art manifest (`manifest.json` written by `tools/art`, pure, no Phaser): parsing, and the layout plan
 * of the asset gallery (groups, tower grid by faction -> role -> level x team, mismatches with the
 * atlas).
 */
import {
  FACTION_IDS,
  TOWERS,
  getFactionTowers,
  isTowerTypeId,
} from '@td/shared';
import type { FactionId, Team, TowerTypeId } from '@td/shared';
import { findModel } from './model-registry.js';

export const MANIFEST_GROUPS = [
  'ground',
  'tower',
  'projectile',
  'creep',
  'fx',
] as const;
export type ManifestGroup = (typeof MANIFEST_GROUPS)[number];

export interface ManifestFrame {
  readonly name: string;
  readonly group: ManifestGroup;
  readonly label: string;
  /** Logical (@1x) size. */
  readonly width: number;
  readonly height: number;
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface ArtManifest {
  readonly frames: readonly ManifestFrame[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isGroup = (v: unknown): v is ManifestGroup =>
  typeof v === 'string' && (MANIFEST_GROUPS as readonly string[]).includes(v);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Validates `manifest.json`; null when it is not a manifest. Malformed entries are skipped. */
export function parseManifest(json: unknown): ArtManifest | null {
  if (!isRecord(json) || !Array.isArray(json['frames'])) return null;
  const frames: ManifestFrame[] = [];
  for (const f of json['frames']) {
    if (!isRecord(f) || typeof f['name'] !== 'string' || !isGroup(f['group']))
      continue;
    const pivot = isRecord(f['pivot']) ? f['pivot'] : {};
    frames.push({
      name: f['name'],
      group: f['group'],
      label: typeof f['label'] === 'string' ? f['label'] : f['name'],
      width: num(f['width'], 0),
      height: num(f['height'], 0),
      pivot: { x: num(pivot['x'], 0.5), y: num(pivot['y'], 0.5) },
    });
  }
  return { frames };
}

const TEAMS: readonly Team[] = ['blue', 'red'];

export interface CreepPlan {
  readonly id: string;
  /** Walk frames in cycle order (index n = `creep/<id>/walk/<n>`). */
  readonly walk: readonly ManifestFrame[];
  readonly shadow: ManifestFrame | null;
}

export interface TowerRowPlan {
  readonly type: TowerTypeId;
  readonly role: string;
  /** cells[level - 1][teamIndex] (teams: blue, red); null when the manifest has no such frame. */
  readonly cells: readonly (readonly (ManifestFrame | null)[])[];
}

export interface FactionPlan {
  readonly faction: FactionId;
  readonly rows: readonly TowerRowPlan[];
}

export interface GalleryPlan {
  readonly ground: readonly ManifestFrame[];
  readonly creeps: readonly CreepPlan[];
  readonly factions: readonly FactionPlan[];
  readonly teams: readonly Team[];
  readonly projectiles: readonly ManifestFrame[];
  readonly fx: readonly ManifestFrame[];
  /** Manifest frames that do not follow the naming convention of their group (shown as is). */
  readonly other: readonly ManifestFrame[];
  /** Manifest frames absent from the atlas. */
  readonly missingFromAtlas: ReadonlySet<string>;
  /** Atlas frames absent from the manifest (sorted). */
  readonly unlisted: readonly string[];
}

const TOWER_RE = /^tower\/(.+)\/(blue|red)$/;
const CREEP_WALK_RE = /^creep\/([^/]+)\/walk\/(\d+)$/;
const CREEP_SHADOW_RE = /^creep\/([^/]+)\/shadow$/;

/** Gallery layout of `manifest`, compared with the frame names present in the atlas. */
export function planGallery(
  manifest: ArtManifest,
  atlasFrames: Iterable<string>,
): GalleryPlan {
  const atlas = new Set(atlasFrames);
  atlas.delete('__BASE');
  const listed = new Set(manifest.frames.map((f) => f.name));
  const ground: ManifestFrame[] = [];
  const projectiles: ManifestFrame[] = [];
  const fx: ManifestFrame[] = [];
  const other: ManifestFrame[] = [];
  const creeps = new Map<
    string,
    { walk: Map<number, ManifestFrame>; shadow: ManifestFrame | null }
  >();
  const towers = new Map<string, ManifestFrame>(); // `${modelId}/${team}` -> frame
  const creepOf = (
    id: string,
  ): { walk: Map<number, ManifestFrame>; shadow: ManifestFrame | null } => {
    let c = creeps.get(id);
    if (!c) {
      c = { walk: new Map(), shadow: null };
      creeps.set(id, c);
    }
    return c;
  };

  for (const frame of manifest.frames) {
    switch (frame.group) {
      case 'ground':
        ground.push(frame);
        break;
      case 'projectile':
        projectiles.push(frame);
        break;
      case 'fx':
        fx.push(frame);
        break;
      case 'creep': {
        const walk = CREEP_WALK_RE.exec(frame.name);
        const shadow = CREEP_SHADOW_RE.exec(frame.name);
        if (walk?.[1] !== undefined)
          creepOf(walk[1]).walk.set(Number(walk[2]), frame);
        else if (shadow?.[1] !== undefined) creepOf(shadow[1]).shadow = frame;
        else other.push(frame);
        break;
      }
      case 'tower': {
        const m = TOWER_RE.exec(frame.name);
        const model = m?.[1] === undefined ? undefined : findModel(m[1]);
        if (m && model) towers.set(`${m[1]}/${m[2]}`, frame);
        else other.push(frame);
        break;
      }
    }
  }

  const factions: FactionPlan[] = [];
  for (const faction of FACTION_IDS) {
    const rows: TowerRowPlan[] = [];
    for (const type of getFactionTowers(faction)) {
      if (!isTowerTypeId(type)) continue;
      const def = TOWERS[type];
      const cells = def.levels.map((level) =>
        TEAMS.map((team) => towers.get(`${level.model}/${team}`) ?? null),
      );
      if (cells.some((row) => row.some((c) => c !== null)))
        rows.push({ type, role: def.role, cells });
    }
    if (rows.length > 0) factions.push({ faction, rows });
  }

  return {
    ground,
    creeps: [...creeps].map(([id, c]) => ({
      id,
      walk: [...c.walk].sort((a, b) => a[0] - b[0]).map(([, f]) => f),
      shadow: c.shadow,
    })),
    factions,
    teams: TEAMS,
    projectiles,
    fx,
    other,
    missingFromAtlas: new Set([...listed].filter((n) => !atlas.has(n))),
    unlisted: [...atlas].filter((n) => !listed.has(n)).sort(),
  };
}

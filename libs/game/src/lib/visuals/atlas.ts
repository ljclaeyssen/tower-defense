/**
 * Sprite atlas contract (pure, no Phaser): frame names, file names and the `SpriteRef` every scene
 * draws with, whether it points at an atlas frame or at a procedurally baked placeholder texture.
 *
 * The atlas is a Phaser "JSON Hash" atlas built by `tools/art` (`atlas@2x.png` + `atlas@2x.json`, one
 * `pivot` per frame) served next to `manifest.json`. The game loads the @2x files and displays frames
 * at {@link ATLAS_DISPLAY_SCALE}, so 1 logical (world) px = 2 atlas px.
 */
import type { GroundKind } from '../ground.js';

/** Texture key of the art atlas. */
export const ATLAS_KEY = 'art';
/** Scale that displays an @2x atlas frame at its logical size. */
export const ATLAS_DISPLAY_SCALE = 0.5;
export const DEFAULT_ASSETS_BASE_URL = '/assets/';

/**
 * A drawable: texture key (+ frame), the scale that displays it at its logical size, its logical size
 * (for bounds, hit tests and occlusion) and its normalised origin (anchor / pivot).
 * Consumers apply it with `setTexture(key, frame).setScale(displayScale).setOrigin(originX, originY)`.
 */
export interface SpriteRef {
  readonly key: string;
  readonly frame?: string;
  readonly displayScale: number;
  /** Logical (world px) size. */
  readonly width: number;
  readonly height: number;
  /** Normalised anchor in the frame (0..1). */
  readonly originX: number;
  readonly originY: number;
}

// ---- Frame names --------------------------------------------------------------------------------

export const groundFrameName = (kind: GroundKind): string => `ground/${kind}`;
export const GROUND_FLASH_FRAME = 'ground/flash';
export const PARTICLE_FRAME = 'fx/particle';
/** Frames of a creep walk cycle (`creep/<id>/walk/0..n-1`). */
export const CREEP_WALK_FRAMES = 4;
export const creepWalkFrameName = (creepId: string, n: number): string =>
  `creep/${creepId}/walk/${n}`;
export const creepShadowFrameName = (creepId: string): string =>
  `creep/${creepId}/shadow`;

// ---- Files --------------------------------------------------------------------------------------

export interface ArtUrls {
  readonly png: string;
  readonly json: string;
  readonly manifest: string;
}

/** URLs of the @2x atlas and the manifest under `baseUrl` (a missing trailing slash is added). */
export function artUrls(baseUrl: string = DEFAULT_ASSETS_BASE_URL): ArtUrls {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    png: `${base}atlas@2x.png`,
    json: `${base}atlas@2x.json`,
    manifest: `${base}manifest.json`,
  };
}

// ---- Atlas JSON ---------------------------------------------------------------------------------

/** One validated frame of the atlas JSON, in atlas (texture) px. */
export interface AtlasFrameEntry {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Untrimmed size (equals w x h for untrimmed frames). */
  readonly sourceW: number;
  readonly sourceH: number;
  /** Position of the trimmed frame inside the source size (0, 0 when untrimmed). */
  readonly trimX: number;
  readonly trimY: number;
  readonly trimmed: boolean;
  /** Normalised pivot (0.5, 0.5 when the frame has none). */
  readonly pivotX: number;
  readonly pivotY: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Validates a Phaser JSON Hash atlas and returns its usable frames, or null when it is not an atlas
 * (e.g. an HTML fallback page parsed as JSON). Rotated or malformed frames are skipped.
 */
export function parseAtlasJson(json: unknown): AtlasFrameEntry[] | null {
  if (!isRecord(json) || !isRecord(json['frames'])) return null;
  const out: AtlasFrameEntry[] = [];
  for (const [name, src] of Object.entries(json['frames'])) {
    if (!isRecord(src) || !isRecord(src['frame']) || src['rotated'] === true)
      continue;
    const f = src['frame'];
    const w = num(f['w'], 0);
    const h = num(f['h'], 0);
    if (w <= 0 || h <= 0) continue;
    const source = isRecord(src['sourceSize']) ? src['sourceSize'] : {};
    const sprite = isRecord(src['spriteSourceSize'])
      ? src['spriteSourceSize']
      : {};
    const pivot = isRecord(src['pivot']) ? src['pivot'] : {};
    const trimmed = src['trimmed'] === true;
    out.push({
      name,
      x: num(f['x'], 0),
      y: num(f['y'], 0),
      w,
      h,
      sourceW: num(source['w'], w),
      sourceH: num(source['h'], h),
      trimX: trimmed ? num(sprite['x'], 0) : 0,
      trimY: trimmed ? num(sprite['y'], 0) : 0,
      trimmed,
      pivotX: num(pivot['x'], 0.5),
      pivotY: num(pivot['y'], 0.5),
    });
  }
  return out;
}

/** What a sprite needs from a frame: untrimmed size in texture px and normalised pivot. */
export interface FrameGeometry {
  readonly sourceW: number;
  readonly sourceH: number;
  readonly pivotX: number;
  readonly pivotY: number;
}

/** SpriteRef of a frame displayed at `displayScale`: logical size = source size x scale, origin = pivot. */
export function spriteRefFromFrame(
  key: string,
  frame: string,
  geometry: FrameGeometry,
  displayScale: number = ATLAS_DISPLAY_SCALE,
): SpriteRef {
  return {
    key,
    frame,
    displayScale,
    width: geometry.sourceW * displayScale,
    height: geometry.sourceH * displayScale,
    originX: geometry.pivotX,
    originY: geometry.pivotY,
  };
}

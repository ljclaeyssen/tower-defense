import * as Phaser from 'phaser';
import { ATLAS_KEY, artUrls, parseAtlasJson } from '../visuals/atlas.js';
import type { AtlasFrameEntry } from '../visuals/atlas.js';
import { parseManifest } from '../visuals/art-manifest.js';
import type { ArtManifest } from '../visuals/art-manifest.js';

/**
 * Loading of the art atlas and manifest, tolerant of missing or invalid files.
 *
 * The atlas JSON is loaded as plain text and validated first; only a valid atlas queues its image
 * (under {@link ATLAS_KEY}), and {@link installArt} then adds the frames to it. Phaser's own
 * atlas/JSON loaders would throw (or log errors) when the server answers a missing file with the SPA
 * `index.html`. Without a valid atlas there is no atlas texture, so every sprite lookup falls back to
 * the procedural placeholders.
 */

const ATLAS_JSON_KEY = 'art-atlas-json';
const MANIFEST_KEY = 'art-manifest';

export interface ArtLoadResult {
  /** True when the atlas texture is available with its frames. */
  readonly atlas: boolean;
  /** Parsed manifest, when requested and valid. */
  readonly manifest: ArtManifest | null;
}

interface PendingArt {
  /** Files that failed to load or validate. */
  readonly problems: string[];
  /** Validated atlas frames, waiting for the image. */
  frames: AtlasFrameEntry[] | null;
}

const pending = new WeakMap<Phaser.Scene, PendingArt>();

/** Queues the atlas (and optionally the manifest) on the scene loader. Call from `preload()`. */
export function queueArt(
  scene: Phaser.Scene,
  baseUrl: string,
  options: { readonly manifest: boolean },
): void {
  const urls = artUrls(baseUrl);
  const state: PendingArt = { problems: [], frames: null };
  pending.set(scene, state);
  const load = scene.load;
  const onError = (file: Phaser.Loader.File): void => {
    state.problems.push(String(file.url ?? file.key));
  };
  load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  load.once(Phaser.Loader.Events.COMPLETE, () =>
    load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError),
  );
  if (!scene.textures.exists(ATLAS_KEY)) {
    load.once(
      `${Phaser.Loader.Events.FILE_KEY_COMPLETE}text-${ATLAS_JSON_KEY}`,
      (_key: string, _type: string, text: unknown) => {
        scene.cache.text.remove(ATLAS_JSON_KEY);
        const frames = parseAtlasJson(safeJson(text));
        if (frames && frames.length > 0) {
          state.frames = frames;
          load.image(ATLAS_KEY, urls.png); // joins the running load
        } else {
          state.problems.push(`${urls.json} is not a valid atlas`);
        }
      },
    );
    load.text(ATLAS_JSON_KEY, urls.json);
  }
  if (options.manifest) load.text(MANIFEST_KEY, urls.manifest);
}

/**
 * Adds the validated frames to the loaded atlas image and parses the manifest. Call at the start of
 * `create()`. Warns once (per scene start) when the art is missing or invalid.
 */
export function installArt(scene: Phaser.Scene): ArtLoadResult {
  const state = pending.get(scene) ?? { problems: [], frames: null };
  pending.delete(scene);
  const problems = state.problems;

  const textures = scene.textures;
  if (state.frames && textures.exists(ATLAS_KEY)) {
    const texture = textures.get(ATLAS_KEY);
    for (const e of state.frames) {
      const frame = texture.add(e.name, 0, e.x, e.y, e.w, e.h);
      if (!frame) continue;
      if (e.trimmed)
        frame.setTrim(e.sourceW, e.sourceH, e.trimX, e.trimY, e.w, e.h);
      frame.customPivot = true;
      frame.pivotX = e.pivotX;
      frame.pivotY = e.pivotY;
    }
  }
  const atlas =
    textures.exists(ATLAS_KEY) && textures.get(ATLAS_KEY).frameTotal > 1;

  let manifest: ArtManifest | null = null;
  const textCache = scene.cache.text;
  if (textCache.exists(MANIFEST_KEY)) {
    manifest = parseManifest(safeJson(textCache.get(MANIFEST_KEY)));
    textCache.remove(MANIFEST_KEY);
    if (!manifest) problems.push('manifest.json is not a valid manifest');
  }

  const details = problems.join(', ');
  if (!atlas)
    console.warn(
      `[td/game] art atlas unavailable, using procedural placeholders (${details || 'no atlas'})`,
    );
  else if (details) console.warn(`[td/game] art partially loaded (${details})`);
  return { atlas, manifest };
}

function safeJson(text: unknown): unknown {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

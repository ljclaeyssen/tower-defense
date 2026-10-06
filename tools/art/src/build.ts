/**
 * Entry point of `nx run art:build` (and `art:watch`).
 * manifest → SVG → PNG (resvg, @1x and @2x) → shelf packing → atlas pages (Phaser JSON Hash),
 * manifest.json and a contact sheet, written to apps/web/public/assets/.
 *
 * Flags: --watch (rebuild on generator or data changes), --only=<prefix>[,<prefix>] (subset of
 * frames, still a valid atlas), --out=<dir> (another output directory, e.g. for QA).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { FRAME_GROUPS, buildManifest, filterManifest } from './manifest.js';
import type { FrameEntry, FrameGroup } from './manifest.js';
import type { Sprite } from './generators/types.js';
import { pack } from './pack.js';
import type { PackedPage } from './pack.js';
import { blit, createImage, encodePng, extrude, unpremultiply } from './png.js';
import type { Image } from './png.js';
import {
  Defs,
  el,
  group,
  image,
  line,
  polygon,
  rect,
  svgDoc,
  text,
} from './svg.js';

const here = dirname(fileURLToPath(import.meta.url));
export const OUTPUT_DIR = resolve(here, '../../../apps/web/public/assets');
const WATCH_DIRS = [here, resolve(here, '../../../libs/shared/src/data')];

export const SCALES = [1, 2] as const;
export type Scale = (typeof SCALES)[number];
export const PADDING = 2;
export const EXTRUDE = 1;

export interface RenderedFrame {
  readonly entry: FrameEntry;
  readonly sprite: Sprite;
  readonly images: Readonly<Record<Scale, Image>>;
}

/** Rasterises a sprite at `scale` (straight-alpha RGBA). */
export function renderSprite(sprite: Sprite, scale: number): Image {
  const rendered = new Resvg(sprite.svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts: false },
    shapeRendering: 2,
  }).render();
  const width = Math.round(sprite.width * scale);
  const height = Math.round(sprite.height * scale);
  if (rendered.width !== width || rendered.height !== height)
    throw new Error(
      `Rendered ${rendered.width}x${rendered.height}, expected ${width}x${height}`,
    );
  return {
    width,
    height,
    data: unpremultiply(new Uint8Array(rendered.pixels)),
  };
}

export function renderFrame(entry: FrameEntry): RenderedFrame {
  const sprite = entry.generate();
  return {
    entry,
    sprite,
    images: { 1: renderSprite(sprite, 1), 2: renderSprite(sprite, 2) },
  };
}

/** Phaser "JSON Hash" atlas of one page. */
export function atlasJson(
  page: PackedPage,
  frames: ReadonlyMap<string, RenderedFrame>,
  imageName: string,
  scale: Scale,
): unknown {
  const out: Record<string, unknown> = {};
  for (const r of [...page.rects].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const f = frames.get(r.name);
    if (!f) throw new Error(`Missing frame ${r.name}`);
    out[r.name] = {
      frame: { x: r.x, y: r.y, w: r.width, h: r.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: r.width, h: r.height },
      sourceSize: { w: r.width, h: r.height },
      pivot: {
        x: f.sprite.pivot.x / f.sprite.width,
        y: f.sprite.pivot.y / f.sprite.height,
      },
    };
  }
  return {
    frames: out,
    meta: {
      app: '@td/art',
      version: '1',
      image: imageName,
      format: 'RGBA8888',
      size: { w: page.size, h: page.size },
      scale: String(scale),
    },
  };
}

/** Composes a page: blits every frame and extrudes its border. */
export function composePage(
  page: PackedPage,
  frames: ReadonlyMap<string, RenderedFrame>,
  scale: Scale,
): Image {
  const img = createImage(page.size, page.size);
  for (const r of page.rects) {
    const f = frames.get(r.name);
    if (!f) throw new Error(`Missing frame ${r.name}`);
    blit(img, f.images[scale], r.x, r.y);
    extrude(img, r.x, r.y, r.width, r.height, EXTRUDE);
  }
  return img;
}

const pageName = (scale: Scale, index: number): string =>
  `atlas@${scale}x${index === 0 ? '' : `-${index}`}`;

// Contact sheet ----------------------------------------------------------------------------------

const SHEET_WIDTH = 1700;

function contactSheet(frames: readonly RenderedFrame[], zoom: number): Buffer {
  const defs = new Defs('c');
  const body: string[] = [];
  let y = 16;
  const sections: { title: string; frames: RenderedFrame[] }[] = [];
  for (const groupId of FRAME_GROUPS) {
    for (const f of frames.filter((fr) => fr.entry.group === groupId)) {
      const title = `${groupId}${f.entry.section !== groupId ? ` · ${f.entry.section}` : ''}`;
      const last = sections[sections.length - 1];
      if (last?.title === title) last.frames.push(f);
      else sections.push({ title, frames: [f] });
    }
  }
  for (const section of sections) {
    body.push(
      text(16, y + 14, section.title, {
        'font-size': 16,
        'font-weight': 'bold',
        fill: '#e8e2d0',
      }),
    );
    y += 26;
    let x = 16;
    let rowH = 0;
    for (const f of section.frames) {
      const w = f.sprite.width * zoom;
      const h = f.sprite.height * zoom;
      const cellW = Math.max(w, f.entry.label.length * 5.6) + 12;
      if (x + cellW > SHEET_WIDTH - 16 && x > 16) {
        x = 16;
        y += rowH + 8;
        rowH = 0;
      }
      const px = x + f.sprite.pivot.x * zoom;
      const py = y + f.sprite.pivot.y * zoom;
      const cell: string[] = [
        rect(x - 2, y - 2, w + 4, h + 4, {
          fill: 'none',
          stroke: '#ffffff',
          'stroke-opacity': 0.12,
        }),
      ];
      if (f.entry.group === 'tower' || f.entry.group === 'ground') {
        const hw = (f.entry.group === 'tower' ? 32 : 16) * zoom;
        cell.push(
          polygon(
            [
              [px, py - hw / 2],
              [px + hw, py],
              [px, py + hw / 2],
              [px - hw, py],
            ],
            {
              fill: 'none',
              stroke: '#33e0ff',
              'stroke-opacity': 0.35,
              'stroke-width': 1,
            },
          ),
        );
      }
      const src = f.images[2];
      const png = encodePng(src.width, src.height, src.data);
      cell.push(
        image(x, y, w, h, `data:image/png;base64,${png.toString('base64')}`),
        line([px - 3, py], [px + 3, py], {
          stroke: '#ff3366',
          'stroke-width': 1,
        }),
        line([px, py - 3], [px, py + 3], {
          stroke: '#ff3366',
          'stroke-width': 1,
        }),
        text(x, y + h + 12, f.entry.label, {
          'font-size': 10,
          fill: '#b9b4a6',
        }),
      );
      body.push(group({}, cell));
      x += cellW;
      rowH = Math.max(rowH, h + 18);
    }
    y += rowH + 18;
  }
  const height = Math.ceil(y);
  const checker = el(
    'pattern',
    { id: 'checker', width: 16, height: 16, patternUnits: 'userSpaceOnUse' },
    rect(0, 0, 16, 16, { fill: '#26262b' }),
    rect(0, 0, 8, 8, { fill: '#2e2e34' }),
    rect(8, 8, 8, 8, { fill: '#2e2e34' }),
  );
  const svg = svgDoc(
    SHEET_WIDTH,
    height,
    [
      el('defs', {}, checker),
      rect(0, 0, SHEET_WIDTH, height, { fill: 'url(#checker)' }),
      body,
    ],
    defs,
  );
  return new Resvg(svg, {
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Arial',
      sansSerifFamily: 'Arial',
    },
  })
    .render()
    .asPng();
}

// Build -----------------------------------------------------------------------------------------

export interface BuildOptions {
  readonly only: readonly string[];
  readonly outDir: string;
  readonly contactSheet: boolean;
  /** Display zoom of the frames on the contact sheet (logical px → sheet px). */
  readonly sheetZoom: number;
}

export function build(options: BuildOptions): void {
  const t0 = performance.now();
  const entries = filterManifest(buildManifest(), options.only);
  if (entries.length === 0)
    throw new Error(`No frame matches --only=${options.only.join(',')}`);
  const rendered = entries.map(renderFrame);
  const byName = new Map(rendered.map((f) => [f.entry.name, f]));
  const t1 = performance.now();

  mkdirSync(options.outDir, { recursive: true });
  for (const file of readdirSync(options.outDir))
    if (/^atlas@\dx(-\d+)?\.(png|json)$/.test(file))
      rmSync(join(options.outDir, file));

  const summary: string[] = [];
  for (const scale of SCALES) {
    const pages = pack(
      rendered.map((f) => ({
        name: f.entry.name,
        width: f.images[scale].width,
        height: f.images[scale].height,
      })),
      { padding: PADDING, extrude: EXTRUDE },
    );
    pages.forEach((page, i) => {
      const name = pageName(scale, i);
      const img = composePage(page, byName, scale);
      writeFileSync(
        join(options.outDir, `${name}.png`),
        encodePng(img.width, img.height, img.data),
      );
      writeFileSync(
        join(options.outDir, `${name}.json`),
        `${JSON.stringify(atlasJson(page, byName, `${name}.png`, scale), null, 1)}\n`,
      );
      summary.push(`${name} ${page.size}² (${page.rects.length} frames)`);
    });
  }
  const t2 = performance.now();

  const counts = new Map<FrameGroup, number>();
  for (const f of rendered)
    counts.set(f.entry.group, (counts.get(f.entry.group) ?? 0) + 1);
  const manifest = {
    version: 1,
    frames: rendered.map((f) => ({
      name: f.entry.name,
      group: f.entry.group,
      label: f.entry.label,
      width: f.sprite.width,
      height: f.sprite.height,
      pivot: {
        x: f.sprite.pivot.x / f.sprite.width,
        y: f.sprite.pivot.y / f.sprite.height,
      },
      pivotPx: f.sprite.pivot,
    })),
  };
  writeFileSync(
    join(options.outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 1)}\n`,
  );
  if (options.contactSheet)
    writeFileSync(
      join(options.outDir, 'contact-sheet.png'),
      contactSheet(rendered, options.sheetZoom),
    );
  const t3 = performance.now();

  const ms = (a: number, b: number): string => `${Math.round(b - a)} ms`;
  console.log(
    `[art] ${rendered.length} frames (${[...counts].map(([g, n]) => `${g} ${n}`).join(', ')}) → ${summary.join(', ')}`,
  );
  console.log(
    `[art] render ${ms(t0, t1)}, pack+png ${ms(t1, t2)}, manifest+sheet ${ms(t2, t3)}, total ${ms(t0, t3)} → ${options.outDir}`,
  );
}

// CLI -------------------------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): BuildOptions & { watch: boolean } {
  const value = (flag: string): string | undefined =>
    argv.find((a) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  return {
    watch: argv.includes('--watch'),
    only: (value('only') ?? '').split(',').filter(Boolean),
    outDir: resolve(value('out') ?? OUTPUT_DIR),
    contactSheet: !argv.includes('--no-sheet'),
    sheetZoom: Number(value('sheet-zoom') ?? 2),
  };
}

/** Watch mode: every rebuild runs in a fresh child process so edited generator modules are reloaded. */
function watchMode(argv: readonly string[]): void {
  const childArgs = [
    ...process.execArgv,
    fileURLToPath(import.meta.url),
    ...argv.filter((a) => a !== '--watch'),
  ];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;
  const run = (): void => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    const start = performance.now();
    const child = spawn(process.execPath, childArgs, { stdio: 'inherit' });
    child.on('exit', (code) => {
      running = false;
      console.log(
        `[art] ${code === 0 ? 'rebuilt' : 'build FAILED'} in ${Math.round(performance.now() - start)} ms, watching…`,
      );
      if (pending) {
        pending = false;
        run();
      }
    });
  };
  for (const dir of WATCH_DIRS)
    watch(dir, { recursive: true }, (_event, file) => {
      if (file && /\.spec\.ts$/.test(String(file))) return;
      clearTimeout(timer);
      timer = setTimeout(run, 200);
    });
  run();
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.watch) watchMode(argv);
  else build(args);
}

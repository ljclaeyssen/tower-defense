# Tower Defense — isometric 2D fantasy TD (PvE + PvP), Warcraft 3 TD style

Nx monorepo, TypeScript strict everywhere. Angular shell + Phaser 4 renderer + pure-TS simulation +
Colyseus server. Works on Windows and macOS: every script is Node/TS (`tsx`), never bash-only; LF
line endings are enforced by `.gitattributes`.

## Layout and dependency rules (enforced by Nx tags + `@nx/enforce-module-boundaries`)

| Project | Path          | Package      | Tag            | May depend on |
| ------- | ------------- | ------------ | -------------- | ------------- |
| web     | `apps/web`    | —            | `scope:web`    | game, shared  |
| server  | `apps/server` | `@td/server` | `scope:server` | sim, shared   |
| game    | `libs/game`   | `@td/game`   | `scope:game`   | sim, shared   |
| sim     | `libs/sim`    | `@td/sim`    | `scope:sim`    | shared        |
| shared  | `libs/shared` | `@td/shared` | `scope:shared` | —             |

- `libs/sim` is pure: no Phaser, no DOM, no Colyseus, no Node. Its tsconfig has `lib: ["ES2022"]`,
  `types: []`; its eslint forbids those imports and non-deterministic APIs (`Math.random`, trig,
  `Date`, timers). Only `+ - * /`, `Math.sqrt`, floor/ceil/round/min/max/abs are allowed in the sim.
- The Colyseus schema lives in `apps/server` (or `libs/shared` later), never in `libs/sim`.
- All balance data (towers, creeps, waves, maps, economy) lives in `libs/shared/src/data/*.json`,
  typed with `satisfies` in `libs/shared/src/data/index.ts`. Never hard-code stats.

## Workspace conventions (Nx 23 "TS solution" + npm workspaces)

- Import other projects only through `@td/shared`, `@td/sim`, `@td/game` (npm workspace symlinks to
  `src/index.ts`; no tsconfig paths). When a project starts depending on another one, add
  `"@td/<x>": "*"` to its `package.json` and run `npx nx sync`.
- Libs and the server use `nodenext`: relative imports need the `.js` extension and JSON imports need
  `with { type: 'json' }`. The Angular app uses bundler resolution (extensions optional).
- Strict flags on: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noImplicitReturns`,
  `noImplicitOverride`. Read env vars as `process.env['X']`.
- Tests sit next to sources as `*.spec.ts`, vitest globals on. Libs/server run through `@nx/vitest`
  (node env); the web app runs through `@angular/build:unit-test` (jsdom).
- Vitest is 5.x; Nx's plugin declares 4.x, so root `package.json` has
  `overrides: { "@nx/vitest": { "vitest": "$vitest" } }`. Generators that add vitest write `~4.1.0`:
  reset to 5.0.3.
- Angular generators refuse the TS-solution layout; `.env` sets `NX_IGNORE_UNSUPPORTED_TS_SETUP=true`
  so `nx g @nx/angular:*` works. `apps/web` is excluded from the `@nx/js/typescript` plugin and has
  its own `typecheck` target (`tsc --noEmit`).
- PrimeNG 22 needs a PrimeUI license key (free community key). It is read from
  `apps/web/src/environments/license.ts` (gitignored, created from `license.example.ts` by
  `tools/scripts/postinstall.ts`). Without a key PrimeNG only logs a warning.
- Node: Angular 22 declares `^22.22.3 || ^24.15.0`; 22.16 works with an EBADENGINE warning.

## Commands

```
npm run dev            # nx serve web      → http://localhost:4200
npm run dev:server     # nx serve server   → http://localhost:2567/health
npm test               # nx run-many -t test
npm run lint           # nx run-many -t lint
npm run build          # nx run-many -t build
npx nx run-many -t typecheck lint test build   # full check
npx nx test sim        # sim tests incl. determinism
```

Art pipeline (`npx nx run art:build`, watch mode) arrives in phase 2.

## Simulation (`libs/sim`)

- Fixed 20 Hz tick (`TICK_RATE`, `TICK_MS` in shared). `step()` advances one tick; never reads a clock.
- Seeded mulberry32 PRNG stored in the game and hashed.
- Square fine grid; iso projection exists only in the renderer. Tower footprint 2×2, `pos` = top-left
  cell, visual anchor = footprint center `(pos.x + 1, pos.y + 1)`. Continuous positions in cell
  units, cell center = `(i + 0.5, j + 0.5)`.
- One lane per player from day one (`GameConfig.players[]`), PvE = one player.
- Input = `Command` (PlaceTower, UpgradeTower, SellTower, SendCreeps, StartWave); output =
  `GameEvent` (TowerPlaced, TowerUpgraded, TowerSold, CreepSpawned, ProjectileFired, CreepHit,
  CreepKilled, LifeLost, WaveStarted, GoldChanged, CommandRejected, GameOver).
- Map model: every cell is `ground` (buildable, not walkable), `path` (the drawn road: walkable, not
  buildable) or `rock` (neither). `MapDef.path` is an axis-aligned polyline of waypoints (first =
  spawn, last = exit) expanded by `expandPath`; `rocks` decorate; `groundWalkable: true` turns a map
  into the open-field mazing mode for later PvP maps. `basic` is a 24×16 serpentine road.
- Flow field = BFS 4-connected from the exit over walkable cells, recomputed after each place/sell.
  Placement is rejected on non-ground cells (`CellBlocked`); on `groundWalkable` maps it is also
  rejected if it traps the spawn or a living creep (`BlocksPath`) or overlaps a creep
  (`OverlapsCreep`).
- Tick order: wave timer/spawns → towers target+fire → projectiles move+hit → creeps move+leak →
  income → end-of-game → tick++.
- API: `createGame(config, seed)`, `apply(cmd, playerId) → CommandResult`, `step()`, `getState()`
  (immutable cached snapshot), `drainEvents()`, `hash()` (FNV-1a 32-bit). Plus pure helpers
  `validatePlacement`, `computeFlowField`, `footprintCells`, `towerCenter`.

## Renderer (`libs/game`)

- Phaser 4 (`phaser@4.2.x`). `setTintFill` is gone: `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
- Iso 2:1, `TILE_W = 32`, `TILE_H = 16`: `screenX = (x − y)·16`, `screenY = (x + y)·8`. Depth =
  screen Y. Flat objects rotate in the ground plane then `scaleY 0.5`; only tall units get 8
  directional frames (phase 2).
- `GameSession` interface with `LocalSession` (sim in browser) and `RemoteSession` (Colyseus, phase 3).
  The renderer interpolates between the previous and current tick snapshots using `alpha()`.
- `GameBridge` pushes a `HudSnapshot` to the host at most once per sim tick.
- Entry points: `launchGame({ parent, session }) → { bridge, destroy }`, `launchGallery({ parent })`,
  `createLocalSession({ config, seed })`.

## Web (`apps/web`)

- Angular 22 standalone, zoneless, signals, OnPush, PrimeNG Aura (dark). Routes: `/`, `/lobby`,
  `/play/:mode`, `/dev/gallery`.
- i18n at runtime with `@ngx-translate/core` 18, files in `apps/web/public/i18n/{en,fr}.json`,
  English default. Every visible string goes through translation.
- `GameHostComponent` creates the Phaser game after first render and calls `destroy(true)` on
  destroy. `GameFacade` exposes HUD signals fed by the bridge (never per frame). HUD is Angular,
  overlaid on the canvas; the canvas only draws the world.

## Art conventions (phase 2)

Sprites are code: parametric TS generators → SVG → PNG via `@resvg/resvg-js` (@1x, @2x) → packed
atlas + JSON in `apps/web/public/assets/`. Iso 2:1, light from the left (left face light, right face
dark, top lightest), grid cell 32×16 logical px, anchor at the footprint center, team colors only via
`palette.ts`. After changing a generator: build, open the PNGs, fix, then hand back.

## Decisions log

- 2026-10-06: Nx 23.2 TS-solution workspace; Angular 22.2 + TypeScript 6.0.3; PrimeNG 22.1 with a
  community license key supplied later by the owner; vitest 5 kept via npm override; Phaser 4.2.1;
  Colyseus 0.18 with `@colyseus/sdk` as the client package; UI in English with runtime i18n (fr
  second); phases delivered one at a time with a stop for manual testing after each.
- 2026-10-06 (owner feedback after the first playtest): creeps follow a drawn road that cannot be
  built on, instead of free mazing on an open field; the open-field mode stays available per map
  (`groundWalkable`). Baked textures are supersampled ×4 and the canvas renders at the device pixel
  ratio because the first build looked pixelated on large screens.
- Nx-generated AI config for other assistants (`.cursor`, `.codex`, `.gemini`, `.opencode`,
  `AGENTS.md`, `opencode.json`) was removed; `.claude/` and `.github/` were kept.

## Dev notes (phase 1)

- The web dev server excludes `@td/game`, `@td/sim` and `@td/shared` from Vite prebundling
  (`prebundle.exclude` in `apps/web/project.json`); otherwise lib edits are not picked up until the
  server restarts.
- The Phaser game instance is attached to its parent element as `__phaserGame` for devtools
  debugging (`document.querySelector('.canvas').__phaserGame`).
- `GameScene.syncCameraSize()` keeps the main camera at the canvas size every frame and refits the
  map until the user pans or zooms. Phaser only auto-resizes cameras that still match the previous
  game size, so a canvas created before its parent had a layout kept a stale camera.
- Balance (archer damage/cooldown) was tuned so that three archers upgraded over time win the five
  waves of `basic`; see `libs/sim/src/lib/balance.spec.ts`.

## Deployment

- Repo: https://github.com/ljclaeyssen/tower-defense (public). CI (`.github/workflows/ci.yml`) runs
  format check, lint, test, build, typecheck on push and PRs.
- Prod: https://tower-defense.ljclaeyssen.fr — static Angular build served by Caddy on the shared
  Hetzner ARM64 VPS (same conventions as the other apps there: `/opt/apps/tower-defense`, one site
  file `/etc/caddy/sites/tower-defense`, source of truth `deploy/Caddyfile.tower-defense`). DNS is a
  wildcard, nothing to configure per subdomain.
- `.github/workflows/deploy.yml` rebuilds and rsyncs the front on every push to `main`; it needs the
  repository secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, which the owner sets by hand.
- Manual deploy from a workstation (used for the first release):
  `npx nx build web --configuration=production`, then tar the `dist/apps/web/browser` folder over
  SSH into `frontend.new`, swap it in, `caddy validate`, `systemctl reload caddy`.
- The Colyseus server is not deployed yet: phase 3/4 adds a Docker image (GHCR, ARM64), a compose
  file in `/opt/apps/tower-defense` bound to `127.0.0.1:2567`, and a `/ws` reverse proxy in the
  Caddy site.

## Factions and tower roles (data-driven)

- Five factions: humans, elves, orcs, undead, dwarves (`libs/shared/src/data/factions.json`), each with one tower per role in
  `TOWER_ROLES` order: `single`, `pierce`, `slow`, `burst`. The order drives the build panel and the
  hotkeys 1-4. A player builds only the towers of `PlayerConfig.faction` (`WrongFaction` otherwise).
- Every tower level (`towers.json`) carries its full `attack` (kind + params), its `projectile`
  (`visual` key, speed) and its `model` key, so a level can change behaviour and looks. Keys:
  model `"<towerId>-<level>"`, projectile visual `"<shape>-<faction>"`.
- The sim resolves impacts by `attack.kind` in `libs/sim/src/lib/projectiles.ts`; the renderer maps
  `model` / `visual` keys through `libs/game/src/lib/visuals/*-registry.ts` (derived placeholders now,
  atlas frames in phase 2 under the same keys).
- **Add a tower**: append an entry to `towers.json` (never reorder: the key order is hashed), list it
  in its faction's `towers` array if it replaces a role, add `towers.<id>.name/desc` in both i18n
  files. Nothing else, unless its `model` / `visual` keys need a registry override.
- **Add a faction**: add it to `factions.json` with 4 tower ids, write the 4 towers, add
  `factions.<id>.name/desc` + tower keys in i18n, give it a palette in the model registry.
- **Add a role**: extend `TowerRole` / `TOWER_ROLES` and `AttackDef` in `schema.ts`, add one impact
  case in the sim, one shape in the registries, one `roles.<role>` i18n key and one HUD stat line.
- The shared spec (`libs/shared/src/lib.spec.ts`) enforces the invariants (one tower per role per
  faction, `attack.kind === role`, key naming); the sim balance spec plays each faction to victory.

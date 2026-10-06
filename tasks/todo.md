# Tasks

## Phase 1 — scaffold + sim + minimal iso rendering + PvE playable

- [x] Verify latest stable versions (Nx 23.2.1, Angular 22.2.1, TS 6.0.3, PrimeNG 22.1.2, Phaser 4.2.1, Colyseus 0.18.9 / @colyseus/sdk 0.18.5, vitest 5.0.3, resvg-js 2.6.2)
- [x] Nx workspace: apps/web (Angular), apps/server (Colyseus skeleton), libs/shared, libs/sim, libs/game; tags + module boundaries; LF/prettier/editorconfig; postinstall license bootstrap
- [x] `libs/shared` contract: types, commands, events, state, data schemas + JSON
- [x] Public API skeletons for `@td/sim` and `@td/game`
- [x] `libs/sim` implementation + 53 vitest tests (flow field, placement, anti-block, upgrade/sell, economy, waves, projectiles, determinism, balance)
- [x] `libs/game` Phaser 4 renderer (43 tests): iso helpers, LocalSession, bridge, GameScene, GalleryScene placeholder
- [x] `apps/web` (12 tests): routes, i18n en/fr, GameHostComponent, GameFacade, HUD, game-over dialog
- [x] Integration: `nx run-many -t typecheck lint test build` green; browser playtest (place/upgrade/sell, rejections, defeat dialog, play again, route leave)
- [x] Fixes found in playtest: Vite prebundle exclude for workspace libs, camera size sync, tower panel offset above the PrimeUI badge
- [x] Published: public GitHub repo + static front live at https://tower-defense.ljclaeyssen.fr (Caddy, VPS)
- [ ] Owner sets repo secrets VPS_HOST / VPS_USER / VPS_SSH_KEY for the deploy workflow
- [ ] Owner playtest and feedback

## Phase 2 — art pipeline (generators, atlas, gallery, effects)

## Phase 3 — PvP (Colyseus rooms, lobby, RemoteSession, send creeps)

## Phase 4 — VPS deployment (Dockerfile, compose, Caddy)

- [x] Static front + Caddy site (done early, 2026-10-06)
- [ ] Server image (ARM64, GHCR), docker compose, /ws proxy

## Review — phase 1 (2026-10-06)

- All 5 projects pass typecheck, lint, test and build (17 Nx tasks). 112 tests in total.
- Decisions: TS-solution workspace kept (Angular generators need `.env` NX_IGNORE_UNSUPPORTED_TS_SETUP), vitest 5 via npm override, Node 22.16 tolerated (Angular wants 22.22+).
- Known gaps for later phases: victory flow only verified in sim tests (defeat verified in browser); PvP lanes not rendered; RemoteSession stub; art is procedural primitives.

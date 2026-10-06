# Tower Defense

Isometric 2D fantasy tower defense (PvE and 1v1 PvP, Line-Tower-Wars style), built as an Nx
monorepo: Angular shell, Phaser 4 renderer, pure TypeScript deterministic simulation, Colyseus server.

## Getting started

```
npm install          # also bootstraps apps/web/src/environments/license.ts
npm run dev          # web app on http://localhost:4200
npm run dev:server   # Colyseus server on http://localhost:2567
npm test
```

PrimeNG 22 expects a PrimeUI license key (a free community key is enough): paste it into
`apps/web/src/environments/license.ts` (gitignored). Without it PrimeNG only logs a warning.

## Repository map

- `apps/web` — Angular 22 (standalone, zoneless, signals, PrimeNG, ngx-translate)
- `apps/server` — Node + Colyseus 0.18
- `libs/shared` — types, network protocol, typed balance data (JSON)
- `libs/sim` — deterministic 20 Hz simulation, no dependencies
- `libs/game` — Phaser 4 client (scenes, iso rendering, input, effects)
- `tools/scripts` — cross-platform Node/TS scripts

See `CLAUDE.md` for architecture rules, conventions and decisions.

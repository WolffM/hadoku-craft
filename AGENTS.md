# @wolffm/hadoku-craft

## What This Is

Print-prep and colour toolkit. Two routes: **print** (`/craft`) and **palette**
(`/craft/palette`). Three components: React UI library, CF Worker API, local
ImageMagick server.

Renamed from `hadoku-printTool` / `@wolffm/hadoku-printtool`. The palette route
absorbed the standalone `color_palette_picker` repo.

## Architecture

- `src/` — React UI library. Builds to `dist/index.js` + `dist/style.css`
  - Entry: `src/entry.tsx` exports `mount(el, props)` / `unmount(el)`
  - `src/App.tsx` is the shell only: theme boundary, header, route switch
  - `src/routes.ts` + `src/hooks/useRoute.ts` — routing. The mount base is
    DISCOVERED from `location.pathname` (last segment matched against route
    ids), never hard-coded, so the same build serves `/craft/palette` in prod
    and `/palette` under vite. Navigation is `pushState` — a real navigation
    would tear down the host page this app is mounted into.
  - Print route: `src/components/PrintRoute/`, `src/hooks/usePrintTool.ts`,
    `src/domain/modes/`, `src/domain/processing/`
  - Palette route: `src/components/Palette/`, `src/hooks/usePalette.ts`,
    `src/domain/palette/`
  - Domain logic in `src/domain/`, UI in `src/components/`

- `worker/` — CF Worker API handler. Builds to `dist/worker.js`
  - Entry: `worker/src/index.ts` exports `createCraftHandler(basePath)`
  - OpenAPI schemas in `worker/src/schemas.ts`
- `server/` — Local-only Node server (NOT published). ImageMagick + Python pipelines.
  - Runs via PM2: `pnpm local:start`
  - Receives requests via Cloudflare Tunnel managed by hadoku-site
  - `server/python/sticker/` — Python sidecar (sticker pipeline), spawned per request
  - `server/pyproject.toml` — Python deps (Hatchling), installed into `server/.venv/`

## Palette route

`src/domain/palette/` is pure and fully unit-tested — no canvas, no DOM:

- `quantize.ts` — modified median-cut (MMCQ). **Replaces the ColorThief CDN
  script** the standalone tool used; a published library cannot `<script src>`
  off cdnjs. Two invariants worth keeping: empty boxes are discarded (an empty
  box averages to its geometric midpoint, i.e. a colour that is nowhere in the
  image), and unsplittable boxes are retired so a flat graphic terminates.
- `color.ts` — conversions, `sortEntriesByHue` (carries insertion index, so
  removing one of two identical swatches removes the right one).
- `sampling.ts` — pixels are read ONCE on load into an RGBA buffer; every later
  sample is array indexing.
- `prefill.ts` — standard and 5+16 strategies, both deduped.

`PaletteCanvas` note: the pane must keep a DEFINITE height and the canvas must
stay `position: absolute`. With an auto-height pane the canvas's intrinsic size
sets the pane height while the ResizeObserver sets the canvas from the pane —
a feedback loop that hangs the tab.

## Python sidecar deps

Per the hadoku ecosystem convention (`personal-dataplatform/server/CLAUDE.md`):
**per-repo `.venv`**, never global. The Node server resolves the interpreter at
`server/.venv/Scripts/python.exe` (Windows) or `server/.venv/bin/python`. One-time
setup:

```bash
cd server
python -m venv .venv
.venv/Scripts/pip install -e .
```

## Contracts

This repo publishes `@wolffm/hadoku-craft` to GitHub Packages.

- Default export: UI library with `mount(el)` / `unmount(el)` (from `src/entry.tsx`)
- `./api` subpath: CF Worker handler factory (from `worker/src/index.ts`)
- `./style.css` subpath: compiled CSS
- On publish: dispatches `packages_updated` to WolffM/hadoku_site

Peer dependencies (provided by parent): react, react-dom, @wolffm/themes, @wolffm/task-ui-components

## Build

- `pnpm build` — runs three steps: vite build (UI), vite build (worker), tsc (declarations)
- `pnpm dev` — starts PM2 local server + vite dev server with proxy to localhost:8787
- `pnpm test` — runs vitest (happy-dom env, canvas is mocked via `src/test-utils/canvasMock.ts`, pica is mocked per-file)
- `pnpm typecheck`, `pnpm lint`, `pnpm lint:css` — all four gates must be green

## Colors

All colors come from `@wolffm/themes` (consumed here as raw CSS `var(--color-*)`).
Read `node_modules/@wolffm/themes/THEME_USAGE_GUIDE.md` before writing styles.

- **A token names a semantic role, not a hue.** Light/dark is automatic — never branch on theme mode or `[data-theme]`.
- `<f>` ∈ `primary | success | warning | danger | neutral`. Every family has exactly six tokens: `--color-<f>`, `-dark`, `-bg`, `-hover`, `--color-on-<f>`, `--color-on-<f>-bg`. If a name isn't in that shape, it doesn't exist.
- **Filled surface** → `background: var(--color-<f>)` + `color: var(--color-on-<f>)`. **Tint badge/banner** → `background: var(--color-<f>-bg)` + `color: var(--color-on-<f>-bg)` (NOT `var(--color-<f>)` as text — it fails AA in most themes). **Body text** → `var(--color-text)`. **Card** → `var(--color-bg-card)`. **Border** → `var(--color-border)`.
- **Never** `var(--color-x, #hex)` fallbacks (they hide broken tokens) or hex/`white` literals on a filled background.
- `--color-text-tertiary` / `--color-text-muted` are decorative-only (fail AA on most backgrounds); any text a user must read takes `--color-text` or `--color-text-secondary`.
- Verify with `pnpm run lint:css` (runs stylelint + `check-usage` from the package). A reference to a token the theme doesn't define renders as nothing — the gate is the only thing that catches it.

## Does NOT

- Manage Cloudflare Tunnel config (see ../hadoku_site/)
- Publish the local server — it's dev-only
- Use console.log — use `logger` from `@wolffm/task-ui-components` instead
- Depend on a router package — see `src/routes.ts`

## External Dependencies

- Parent site: `../hadoku_site/` (GitHub: WolffM/hadoku_site)
- Production URL: hadoku.me/craft/api
- Tunnel: managed by hadoku-site cloudflared config

## Versioning

Pre-commit hook auto-bumps patch version on every commit.
Patch rolls over at .20 → bumps minor. CI also bumps if version already published.

## Telemetry: where your app's data lives

What a visitor did is in monitoring-api's D1, readable with this repo's own
service key. Query it. Don't use Cloudflare Workers Logs (a normal
`wrangler login` can't read them), and don't ask the operator what a visitor
saw. If the log can't answer, add telemetry.

```sh
K=$(node -p "require('./.devvault.local.json').key")
curl -s -A "Mozilla/5.0 hadoku-agent" -H "X-User-Key: $K" \
  "https://hadoku.me/health/api/logs/query?path=/craft&since=2026-10-27T00:00:00Z&limit=200"
```

- Events your code posts go to `service_events`: `POST /health/api/telemetry`
  with `context.service: "craft"`, read back with
  `GET /health/api/service-events?service=craft`. Not `console.log`.
  Browser events: POST to your own `/craft/api/*` route and relay from
  the backend, which holds the key.
- Only finished requests that reach the edge are logged. A UI app's page
  is served by GitHub Pages, so only its `/craft/api/*` calls show up; a
  tunnel app's whole prefix does.
- `user_id c8c59a87-f8af-4da7-9c99-d9e536b3fca8` is the daily automated tour
  (~09:2x UTC), not a visitor.

Params, write format, caveats: `../hadoku_site/docs/child-apps/TELEMETRY.md`.

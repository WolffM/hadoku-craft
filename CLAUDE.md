# @wolffm/hadoku-craft

## What This Is

Image manipulation tool for print-ready output.
Three components: React UI library, CF Worker API, local ImageMagick server.

## Architecture

- `src/` — React UI library. Builds to `dist/index.js` + `dist/style.css`
  - Entry: `src/entry.tsx` exports `mount(el, props)` / `unmount(el)`
  - Domain logic in `src/domain/`, UI in `src/components/`
- `worker/` — CF Worker API handler. Builds to `dist/worker.js`
  - Entry: `worker/src/index.ts` exports `createCraftHandler(basePath)`
  - OpenAPI schemas in `worker/src/schemas.ts`
- `server/` — Local-only Node server (NOT published). ImageMagick + Python pipelines.
  - Runs via PM2: `pnpm local:start`
  - Receives requests via Cloudflare Tunnel managed by hadoku-site
  - `server/python/sticker/` — Python sidecar (sticker pipeline), spawned per request
  - `server/pyproject.toml` — Python deps (Hatchling), installed into `server/.venv/`

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
- Have tests (no test framework configured)
- Use console.log — use `logger` from `@wolffm/task-ui-components` instead

## External Dependencies

- Parent site: `../hadoku_site/` (GitHub: WolffM/hadoku_site)
- Production URL: hadoku.me/craft/api
- Tunnel: managed by hadoku-site cloudflared config

## Versioning

Pre-commit hook auto-bumps patch version on every commit.
Patch rolls over at .20 → bumps minor. CI also bumps if version already published.

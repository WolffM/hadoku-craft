# @wolffm/hadoku-craft

Print-prep and colour toolkit: tile, collage and lay out images for print, and pull colour
palettes out of them.

Formerly `@wolffm/hadoku-printtool`. The print tool is now one of two routes; the second
absorbed the standalone [color_palette_picker](https://github.com/WolffM/color_palette_picker).

## API Package

The `@wolffm/hadoku-craft/api` subpath exports a Cloudflare Worker handler factory:

```ts
import { createCraftHandler } from '@wolffm/hadoku-craft/api'
export default createCraftHandler('/craft/api')
```

## Overview

Craft is a React-based child app. It integrates with the hadoku parent site for theming and
deployment.

## Routes

| Route            | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `/craft`         | **Print** — the print modes listed below             |
| `/craft/palette` | **Palette** — extract a colour palette from an image |

Routing is hand-rolled (`src/routes.ts`) — two routes, no params, and this app ships as a
library into a host that already owns the document, so a router dependency would not earn
its weight. The mount path is discovered from `location.pathname` rather than hard-coded,
so the same build works at `/craft/palette` in production and `/palette` under vite.

Switching routes uses `pushState`; a real navigation would tear down the host page. Back and
forward work via `popstate`.

## Palette

Load an image, then build a palette of up to 21 colours:

- **Click the image** to sample a colour (3x3 average, so JPEG noise doesn't decide the value)
- **Pan** by dragging, **zoom** with the wheel
- **Prefill** — extract the image's dominant colours
- **Prefill (5+16)** — build a colour _system_: a primary plus four variations, then four
  secondaries plus three each
- **Crop-Prefill** (the ⌐ button beside either prefill) — drag a rectangle and extract from
  just that region
- **Copy Palette** (comma-separated hex) or **Export Palette** (a labelled PNG grid)
- **Undo** up to 10 steps

Keyboard: `Ctrl+Z` undo, `Ctrl+C` copy, `Ctrl+E` export, `Ctrl+S` crop-prefill,
`Ctrl+D` crop-prefill 5+16.

Colour extraction is modified median-cut quantization (MMCQ) implemented in
`src/domain/palette/quantize.ts`. The standalone tool loaded ColorThief from a CDN, which a
published library cannot do; porting it in also removed ColorThief's 20-colour clamp (so a
prefill can fill all 21 slots) and made the extractor unit-testable.

## Print modes

- **Simple Tiling** - Tile a single image across a page (e.g., wallet photos, stickers)
- **Duplex Printing** - Create front/back sheets for double-sided postcards
- **Calibration** - Generate color/density calibration sheets via backend ImageMagick processing
- **Collage** - Auto-tile a pool of images onto a page using a chosen layout algorithm (see below)
- **TCG Proxies** - Lay out trading-card proxies (MTG, Riftbound) at true card size for print
- **Stickers** - Arrange die-cut sticker sheets via backend background-removal processing

### Collage

Drop in a pool of images and the selected algorithm packs them onto the page, solving for a
scale factor that fits everything while respecting the controls below. Output renders to a
canvas and exports as PNG or TIFF.

Layout algorithms:

- **Row Packing (FFD-Row)**: Row-based bin packing, good for similar-sized images
- **Masonry**: Pinterest-style columns, good for portrait-heavy sets
- **Guillotine**: Space-efficient bin packing with guillotine cuts, best for mixed sizes
- **Spiral**: Fill from edges inward in a spiral pattern
- **Treemap**: Recursive space partitioning for balanced layouts

Controls:

- **Paper Size** (11x17, Letter, A4, A3, Legal, …) and **Output DPI** (300 fast / 600 quality)
- **Gap Size** — spacing between images, in inches
- **Max Downscale** — how far images may shrink to fit better
- **Normalize Image Sizes** — scale larger images down more so all images end up similar sizes
- **Min Image Size** — floor on placed image size, in inches
- **Allow Cropping** — crop images (with a crop anchor) to better fill available space

Layouts are driven by a seeded RNG (`SeededRandom`), so a given seed reproduces the same
arrangement; reprocessing without a fixed seed reshuffles for a new layout.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Run the test suite
pnpm test

# Lint and format
pnpm lint:fix
pnpm format
```

### Logging

**Important**: Use the logger from `@wolffm/task-ui-components` instead of `console.log`:

```typescript
import { logger } from '@wolffm/task-ui-components'

logger.info('Message', { key: 'value' })
logger.error('Error occurred', error)
```

Logs are only visible to admins in dev mode.

## Integration

This app is a child component of the [hadoku_site](https://github.com/WolffM/hadoku_site) parent application.

### Props

```typescript
interface CraftProps {
  theme?: string // 'light', 'dark', 'coffee-dark', etc.
}
```

### Mounting

```typescript
import { mount, unmount } from '@wolffm/hadoku-craft'

// Mount the app
mount(document.getElementById('app-root'), {
  theme: 'ocean-dark'
})

// Unmount when done
unmount(document.getElementById('app-root'))
```

## Deployment

Pushes to `main` automatically:

1. Build and publish to GitHub Packages
2. Notify parent site to update
3. Parent pulls new version and redeploys

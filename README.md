# @wolffm/hadoku-craft

Image manipulation tool for tiling, collaging, and preparing images for print-ready output.

## API Package

The `@wolffm/hadoku-craft/api` subpath exports a Cloudflare Worker handler factory:

```ts
import { createCraftHandler } from '@wolffm/hadoku-craft/api'
export default createCraftHandler('/craft/api')
```

## Overview

Craft is a React-based child app that provides image manipulation capabilities for preparing print-ready outputs. Integrates with the hadoku parent site for theming and deployment.

## Modes

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

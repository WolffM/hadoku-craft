# @wolffm/hadoku-craft

**Guide:** [overview](docs/guide/index.md) · [features](docs/guide/features.md) · [contributing](docs/guide/contributing.md) · [history](docs/guide/history.md) · [trivia](docs/guide/trivia.md)

Print-prep and colour toolkit: tile, collage and lay out images for print, and pull colour
palettes out of them. Two routes behind one build — **print** (`/craft`) and **palette**
(`/craft/palette`); what each one does is in [features.md](docs/guide/features.md).

Formerly `@wolffm/hadoku-printtool`. The print tool is now one of two routes; the second
absorbed the standalone [color_palette_picker](https://github.com/WolffM/color_palette_picker)
— see [history.md](docs/guide/history.md) for how.

## API Package

The `@wolffm/hadoku-craft/api` subpath exports a Cloudflare Worker handler factory:

```ts
import { createCraftHandler } from '@wolffm/hadoku-craft/api'
export default createCraftHandler('/craft/api')
```

## Routes

| Route            | What it does                                               |
| ---------------- | ---------------------------------------------------------- |
| `/craft`         | **Print** — tiling, duplex, collage, TCG proxies, stickers |
| `/craft/palette` | **Palette** — extract a colour palette from an image       |

How routing and the two build targets work is in
[contributing.md#architecture](docs/guide/contributing.md#architecture).

## Development

```bash
pnpm install
pnpm dev      # local processing server (PM2) + Vite
pnpm build
pnpm test
```

The local server's one-time setup, the full lint/format/typecheck gates, and the
logging convention are in [contributing.md](docs/guide/contributing.md).

## Integration

This app is a child component of the [hadoku_site](https://github.com/WolffM/hadoku_site)
parent application.

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

Pushes to `main` build, publish and notify the parent site automatically; see
[contributing.md#how-it-deploys](docs/guide/contributing.md#how-it-deploys).

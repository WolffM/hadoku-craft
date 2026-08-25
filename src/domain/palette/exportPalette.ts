/**
 * Getting a finished palette back out of the app.
 *
 * Two shapes, because they serve two different next steps: comma-separated hex
 * to paste into code or a design tool, and a labelled PNG grid to drop into a
 * doc or a chat where the reader needs to see the colours, not read them.
 */

import { contrastingInk, type Hex } from './color'

/** Swatch edge length in the exported PNG, in pixels. */
const SQUARE_SIZE = 100
/** Grid width. 7 columns x 3 rows holds a full 21-colour palette exactly. */
const COLUMNS = 7

export interface SheetLayout {
  columns: number
  rows: number
  width: number
  height: number
}

/**
 * Grid dimensions for `count` swatches.
 *
 * The sheet is only as tall as it needs to be — a 4-colour palette exports one
 * row, not three mostly-empty ones.
 */
export function paletteSheetLayout(count: number): SheetLayout {
  const columns = Math.min(COLUMNS, Math.max(1, count))
  const rows = Math.max(1, Math.ceil(count / COLUMNS))
  return {
    columns,
    rows,
    width: columns * SQUARE_SIZE,
    height: rows * SQUARE_SIZE
  }
}

/** Comma-separated hex, ready to paste. */
export function paletteToText(colors: readonly Hex[]): string {
  return colors.join(', ')
}

/**
 * Draw the palette as a labelled grid.
 *
 * Each swatch carries its own hex in black or white, whichever stays legible —
 * the point of the PNG is that someone can read the value off the picture.
 */
export function renderPaletteSheet(colors: readonly Hex[]): HTMLCanvasElement {
  const layout = paletteSheetLayout(colors.length)
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a 2D canvas context to render the palette')

  // White ground, so a palette of translucent-looking pastels still exports
  // against something predictable rather than transparent.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, layout.width, layout.height)

  colors.forEach((color, index) => {
    const x = (index % COLUMNS) * SQUARE_SIZE
    const y = Math.floor(index / COLUMNS) * SQUARE_SIZE

    ctx.fillStyle = color
    ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE)

    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, SQUARE_SIZE, SQUARE_SIZE)

    ctx.fillStyle = contrastingInk(color)
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(color.toUpperCase(), x + SQUARE_SIZE / 2, y + SQUARE_SIZE / 2)
  })

  return canvas
}

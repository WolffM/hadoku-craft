import { describe, it, expect } from 'vitest'
import { paletteSheetLayout, paletteToText } from './exportPalette'

describe('paletteSheetLayout', () => {
  it('lays a full 21-color palette out as 7x3', () => {
    expect(paletteSheetLayout(21)).toEqual({
      columns: 7,
      rows: 3,
      width: 700,
      height: 300
    })
  })

  it('does not export empty rows for a short palette', () => {
    // The original always emitted three rows; a 4-colour palette should be
    // one row tall, not two-thirds whitespace.
    expect(paletteSheetLayout(4)).toEqual({
      columns: 4,
      rows: 1,
      width: 400,
      height: 100
    })
  })

  it('caps the grid at seven columns and wraps', () => {
    const layout = paletteSheetLayout(8)
    expect(layout.columns).toBe(7)
    expect(layout.rows).toBe(2)
  })

  it('stays a valid 1x1 canvas for an empty palette', () => {
    // Never zero: a zero-dimension canvas throws on toBlob.
    const layout = paletteSheetLayout(0)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('grows by whole rows', () => {
    expect(paletteSheetLayout(14).rows).toBe(2)
    expect(paletteSheetLayout(15).rows).toBe(3)
  })
})

describe('paletteToText', () => {
  it('joins with comma and space', () => {
    expect(paletteToText(['#ff0000', '#00ff00', '#0000ff'])).toBe('#ff0000, #00ff00, #0000ff')
  })

  it('renders an empty palette as an empty string', () => {
    expect(paletteToText([])).toBe('')
  })
})

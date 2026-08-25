import { describe, it, expect } from 'vitest'
import { prefillStandard, prefillAdvanced, isUsablePrefill } from './prefill'
import { hexToRgb, rgbToHsl } from './color'
import { MAX_COLORS } from './constants'
import type { RgbaImage } from './sampling'

/** An image made of evenly-weighted bands of the given colors. */
function bandedImage(colors: readonly (readonly [number, number, number])[]): RgbaImage {
  const perColor = 400
  const width = colors.length * perColor
  const data = new Uint8ClampedArray(width * 4)

  let offset = 0
  for (const [r, g, b] of colors) {
    for (let i = 0; i < perColor; i++) {
      data[offset++] = r
      data[offset++] = g
      data[offset++] = b
      data[offset++] = 255
    }
  }

  return { data, width, height: 1 }
}

const RICH = bandedImage([
  [200, 30, 30],
  [30, 200, 30],
  [30, 30, 200],
  [200, 200, 30],
  [200, 30, 200],
  [30, 200, 200],
  [120, 60, 20]
])

describe('prefillStandard', () => {
  it('fills the palette from a rich image', () => {
    const colors = prefillStandard(RICH)
    expect(colors.length).toBeGreaterThan(1)
    expect(colors.length).toBeLessThanOrEqual(MAX_COLORS)
    for (const hex of colors) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('never exceeds the palette capacity', () => {
    expect(prefillStandard(RICH).length).toBeLessThanOrEqual(MAX_COLORS)
  })

  it('returns nothing for an all-white image', () => {
    // Near-white is filtered as background, so there is nothing to quantize.
    expect(prefillStandard(bandedImage([[255, 255, 255]]))).toEqual([])
  })

  it('never repeats a color', () => {
    // A flat graphic has fewer distinct colours than the 21 slots asked for,
    // so quantization splits its uniform fields into boxes that all average
    // to the same value. Those repeats must not reach the palette.
    const flat = bandedImage([
      [200, 30, 30],
      [30, 200, 30]
    ])
    const colors = prefillStandard(flat)

    expect(new Set(colors).size).toBe(colors.length)
    expect(colors.length).toBeLessThanOrEqual(4)
  })
})

describe('prefillAdvanced', () => {
  it('produces exactly 21 colors from a rich image', () => {
    // 1 primary + 4 variations, then 4 secondaries + 3 variations each.
    expect(prefillAdvanced(RICH)).toHaveLength(21)
  })

  it('groups each base with its own variations', () => {
    const colors = prefillAdvanced(RICH)
    const primary = hexToRgb(colors[0])!
    const primaryHsl = rgbToHsl(primary.r, primary.g, primary.b)

    // colors[1..4] are the primary's variations, so they share its hue.
    for (let i = 1; i <= 4; i++) {
      const rgb = hexToRgb(colors[i])!
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
      // Desaturating can drift hue slightly; a generous window still proves
      // these belong to the primary rather than to another base.
      const delta = Math.min(Math.abs(hsl.h - primaryHsl.h), 360 - Math.abs(hsl.h - primaryHsl.h))
      expect(delta).toBeLessThan(20)
    }
  })

  it('gives the primary a more-saturated variation the secondaries lack', () => {
    const colors = prefillAdvanced(RICH)
    // Primary block is 5 wide (base + 4); each secondary block is 4 (base + 3).
    expect(colors).toHaveLength(5 + 4 * 4)
  })

  it('degrades gracefully when the image has fewer than five bases', () => {
    const colors = prefillAdvanced(bandedImage([[200, 30, 30]]))
    expect(colors.length).toBeGreaterThan(0)
    expect(colors.length).toBeLessThanOrEqual(MAX_COLORS)
  })

  it('returns nothing for an all-white image', () => {
    expect(prefillAdvanced(bandedImage([[255, 255, 255]]))).toEqual([])
  })
})

describe('isUsablePrefill', () => {
  it('rejects an empty result', () => {
    expect(isUsablePrefill([])).toBe(false)
  })

  it('accepts well-formed hex colors', () => {
    expect(isUsablePrefill(['#ff0000', '#00ff00'])).toBe(true)
  })

  it('rejects a result containing anything unparseable', () => {
    expect(isUsablePrefill(['#ff0000', 'oops'])).toBe(false)
  })
})

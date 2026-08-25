import { describe, it, expect } from 'vitest'
import {
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  hslToRgb,
  sortByHue,
  sortEntriesByHue,
  createColorVariations,
  contrastingInk
} from './color'

describe('rgbToHex / hexToRgb', () => {
  it('round-trips every channel', () => {
    for (const rgb of [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 1, g: 128, b: 254 },
      { r: 220, g: 20, b: 60 }
    ]) {
      expect(hexToRgb(rgbToHex(rgb.r, rgb.g, rgb.b))).toEqual(rgb)
    }
  })

  it('zero-pads single-digit channels', () => {
    expect(rgbToHex(0, 8, 15)).toBe('#00080f')
  })

  it('clamps out-of-range channels rather than emitting junk', () => {
    expect(rgbToHex(-20, 300, 128)).toBe('#00ff80')
  })

  it('accepts hex with or without the leading hash, any case', () => {
    expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 })
    expect(hexToRgb('ff8000')).toEqual({ r: 255, g: 128, b: 0 })
  })

  it('returns null for malformed input', () => {
    expect(hexToRgb('#fff')).toBeNull()
    expect(hexToRgb('not a color')).toBeNull()
  })
})

describe('rgbToHsl / hslToRgb', () => {
  it('round-trips saturated colors', () => {
    for (const rgb of [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 200, g: 120, b: 40 }
    ]) {
      const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
      const back = hslToRgb(h, s, l)
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1)
    }
  })

  it('reports greys as zero-saturation', () => {
    const hsl = rgbToHsl(128, 128, 128)
    expect(hsl.s).toBe(0)
    expect(hsl.h).toBe(0)
    expect(hsl.l).toBeCloseTo(50.2, 0)
  })

  it('places primaries at the expected hue angles', () => {
    expect(rgbToHsl(255, 0, 0).h).toBeCloseTo(0)
    expect(rgbToHsl(0, 255, 0).h).toBeCloseTo(120)
    expect(rgbToHsl(0, 0, 255).h).toBeCloseTo(240)
  })
})

describe('sortByHue', () => {
  it('orders red before green before blue', () => {
    expect(sortByHue(['#0000ff', '#00ff00', '#ff0000'])).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('does not mutate its input', () => {
    const input = ['#0000ff', '#ff0000']
    const copy = [...input]
    sortByHue(input)
    expect(input).toEqual(copy)
  })
})

describe('sortEntriesByHue', () => {
  it('sorts by hue while reporting each entry’s insertion index', () => {
    expect(sortEntriesByHue(['#0000ff', '#00ff00', '#ff0000'])).toEqual([
      { hex: '#ff0000', index: 2 },
      { hex: '#00ff00', index: 1 },
      { hex: '#0000ff', index: 0 }
    ])
  })

  it('keeps duplicate colors distinguishable', () => {
    // Both reds sort together, but they carry different indices — which is what
    // lets the sidebar remove the swatch that was actually clicked.
    const entries = sortEntriesByHue(['#ff0000', '#0000ff', '#ff0000'])
    const reds = entries.filter(e => e.hex === '#ff0000')

    expect(reds.map(e => e.index)).toEqual([0, 2])
  })

  it('breaks hue ties by insertion order', () => {
    const entries = sortEntriesByHue(['#808080', '#404040', '#c0c0c0'])
    expect(entries.map(e => e.index)).toEqual([0, 1, 2])
  })

  it('returns an entry for every color', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff0000']
    expect(sortEntriesByHue(colors)).toHaveLength(colors.length)
  })
})

describe('createColorVariations', () => {
  it('returns exactly the requested count', () => {
    expect(createColorVariations(200, 100, 50, 3)).toHaveLength(3)
    expect(createColorVariations(200, 100, 50, 4)).toHaveLength(4)
  })

  it('produces lighter then darker then desaturated, in that order', () => {
    const [lighter, darker, desaturated] = createColorVariations(200, 100, 50, 3)
    const base = rgbToHsl(200, 100, 50)

    const l = (hex: string) => {
      const rgb = hexToRgb(hex)!
      return rgbToHsl(rgb.r, rgb.g, rgb.b)
    }

    expect(l(lighter).l).toBeGreaterThan(base.l)
    expect(l(darker).l).toBeLessThan(base.l)
    expect(l(desaturated).s).toBeLessThan(base.s)
  })

  it('adds a more-saturated variation only at count 4', () => {
    const base = rgbToHsl(150, 120, 110)
    const four = createColorVariations(150, 120, 110, 4)
    const rgb = hexToRgb(four[3])!
    expect(rgbToHsl(rgb.r, rgb.g, rgb.b).s).toBeGreaterThan(base.s)
  })

  it('clamps rather than wrapping at the extremes', () => {
    // Pure white cannot get lighter; the variation must stay a valid colour.
    for (const hex of createColorVariations(255, 255, 255, 4)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
    for (const hex of createColorVariations(0, 0, 0, 4)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('contrastingInk', () => {
  it('picks black on light backgrounds and white on dark', () => {
    expect(contrastingInk('#ffffff')).toBe('#000000')
    expect(contrastingInk('#ffff00')).toBe('#000000')
    expect(contrastingInk('#000000')).toBe('#ffffff')
    expect(contrastingInk('#202080')).toBe('#ffffff')
  })

  it('falls back to black for unparseable input', () => {
    expect(contrastingInk('nonsense')).toBe('#000000')
  })
})

/**
 * Colour conversions and derivations for the palette route.
 *
 * Pure functions over plain numbers — no canvas, no DOM — so the whole file
 * is directly unit-testable.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  /** Degrees, 0–360. */
  h: number
  /** Percent, 0–100. */
  s: number
  /** Percent, 0–100. */
  l: number
}

/** An `#rrggbb` string. Always lower-case on the way out of this module. */
export type Hex = string

const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)))

export function rgbToHex(r: number, g: number, b: number): Hex {
  return '#' + [r, g, b].map(x => clampByte(x).toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: Hex): Rgb | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  }
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l: l * 100 }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6

  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hn = h / 360
  const sn = s / 100
  const ln = l / 100

  if (sn === 0) {
    const v = clampByte(ln * 255)
    return { r: v, g: v, b: v }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tn = t
    if (tn < 0) tn += 1
    if (tn > 1) tn -= 1
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q

  return {
    r: clampByte(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: clampByte(hue2rgb(p, q, hn) * 255),
    b: clampByte(hue2rgb(p, q, hn - 1 / 3) * 255)
  }
}

/**
 * Sort a palette by hue so related colours sit next to each other.
 *
 * Non-mutating: the caller's insertion order is the palette's identity (undo
 * restores it verbatim); hue order is only ever a view of it.
 */
export function sortByHue(colors: readonly Hex[]): Hex[] {
  const hueOf = (hex: Hex): number => {
    const rgb = hexToRgb(hex)
    return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b).h : 0
  }
  return colors.slice().sort((a, b) => hueOf(a) - hueOf(b))
}

export interface PaletteEntry {
  hex: Hex
  /** Position in the palette's insertion order — the entry's real identity. */
  index: number
}

/**
 * Hue-sorted view of a palette that remembers where each swatch came from.
 *
 * The display order and the palette's identity are different things: two
 * swatches can hold the same hex, so a component that only had the sorted hex
 * list would have to `indexOf` to remove one and would delete the first match
 * instead of the one clicked. Carrying the original index removes that class
 * of bug entirely.
 */
export function sortEntriesByHue(colors: readonly Hex[]): PaletteEntry[] {
  return colors
    .map((hex, index) => ({ hex, index }))
    .sort((a, b) => {
      const rgbA = hexToRgb(a.hex)
      const rgbB = hexToRgb(b.hex)
      const hueA = rgbA ? rgbToHsl(rgbA.r, rgbA.g, rgbA.b).h : 0
      const hueB = rgbB ? rgbToHsl(rgbB.r, rgbB.g, rgbB.b).h : 0
      // Ties keep insertion order, so a prefill's base/variation groups stay
      // adjacent instead of shuffling on every re-render.
      return hueA - hueB || a.index - b.index
    })
}

/**
 * Derive up to four harmonious variations of one colour in HSL space.
 *
 * Order is fixed — lighter, darker, desaturated, saturated — because the
 * advanced prefill takes the first `count` of them and the caller's grouping
 * depends on which ones it gets.
 */
export function createColorVariations(r: number, g: number, b: number, count = 3): Hex[] {
  const { h, s, l } = rgbToHsl(r, g, b)

  const lighter = hslToRgb(h, s, Math.min(100, l + 15))
  const darker = hslToRgb(h, s, Math.max(0, l - 15))
  const desaturated = hslToRgb(h, Math.max(0, s - 30), l)
  const saturated = hslToRgb(h, Math.min(100, s + 20), l)

  return [
    rgbToHex(lighter.r, lighter.g, lighter.b),
    rgbToHex(darker.r, darker.g, darker.b),
    rgbToHex(desaturated.r, desaturated.g, desaturated.b),
    rgbToHex(saturated.r, saturated.g, saturated.b)
  ].slice(0, count)
}

/**
 * Black or white, whichever stays readable on `hex`.
 *
 * Deliberately NOT a theme token: this labels swatches inside an exported PNG,
 * which leaves the app and has no theme to inherit.
 */
export function contrastingInk(hex: Hex): '#000000' | '#ffffff' {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000000'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

import { describe, it, expect } from 'vitest'
import { quantize, samplePixels, extractPalette, type PixelRgb } from './quantize'

/** Build an RGBA buffer holding `counts[i]` pixels of `colors[i]`. */
function makeImageData(entries: readonly (readonly [PixelRgb, number])[]): Uint8ClampedArray {
  const total = entries.reduce((n, [, count]) => n + count, 0)
  const data = new Uint8ClampedArray(total * 4)
  let offset = 0
  for (const [[r, g, b], count] of entries) {
    for (let i = 0; i < count; i++) {
      data[offset++] = r
      data[offset++] = g
      data[offset++] = b
      data[offset++] = 255
    }
  }
  return data
}

/** Distance in RGB space — quantization is lossy, so exact equality is wrong. */
function distance(a: PixelRgb, b: PixelRgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

function nearest(target: PixelRgb, candidates: readonly PixelRgb[]): number {
  return Math.min(...candidates.map(c => distance(target, c)))
}

describe('quantize', () => {
  it('recovers well-separated source colors', () => {
    const red: PixelRgb = [220, 20, 20]
    const green: PixelRgb = [20, 200, 40]
    const blue: PixelRgb = [30, 40, 210]

    const pixels: PixelRgb[] = [
      ...Array<PixelRgb>(300).fill(red),
      ...Array<PixelRgb>(300).fill(green),
      ...Array<PixelRgb>(300).fill(blue)
    ]

    const result = quantize(pixels, 3)

    expect(result).toHaveLength(3)
    // 5-bit buckets quantize each channel to within 8, so ~14 is the ceiling
    // for a perfect recovery in 3D.
    for (const source of [red, green, blue]) {
      expect(nearest(source, result)).toBeLessThan(15)
    }
  })

  it('orders results most-significant first', () => {
    // One dominant colour, one rare one. The dominant box carries far more
    // pixels, so it must lead.
    const pixels: PixelRgb[] = [
      ...Array<PixelRgb>(1000).fill([200, 30, 30]),
      ...Array<PixelRgb>(10).fill([30, 30, 200])
    ]

    const result = quantize(pixels, 2)

    expect(result).toHaveLength(2)
    expect(distance(result[0], [200, 30, 30])).toBeLessThan(15)
  })

  it('returns fewer colors than asked when the image has fewer', () => {
    const pixels: PixelRgb[] = Array<PixelRgb>(500).fill([128, 128, 128])
    const result = quantize(pixels, 8)

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(8)
    for (const c of result) {
      expect(distance(c, [128, 128, 128])).toBeLessThan(15)
    }
  })

  it('fills all 21 palette slots on a rich image', () => {
    // 21 distinct hues, evenly weighted — the case the "Prefill" button hits.
    const pixels: PixelRgb[] = []
    for (let i = 0; i < 21; i++) {
      const angle = (i / 21) * 2 * Math.PI
      const color: PixelRgb = [
        Math.round(128 + 120 * Math.cos(angle)),
        Math.round(128 + 120 * Math.sin(angle)),
        Math.round(128 + 120 * Math.cos(angle + 2))
      ]
      for (let n = 0; n < 200; n++) pixels.push(color)
    }

    // ColorThief clamped this to 20; the in-house quantizer must reach 21.
    expect(quantize(pixels, 21)).toHaveLength(21)
  })

  it('never invents a color the image does not contain', () => {
    // Two flat colours, 20 requested. A box with no pixels in it has no
    // average to report and falls back to its geometric midpoint — roughly
    // (115, 115, 115) here, which is in neither band. Those empty boxes must
    // be discarded, so this returns 2 colours and not one more.
    const red: PixelRgb = [200, 30, 30]
    const green: PixelRgb = [30, 200, 30]
    const pixels: PixelRgb[] = [
      ...Array<PixelRgb>(400).fill(red),
      ...Array<PixelRgb>(400).fill(green)
    ]

    const result = quantize(pixels, 20)

    expect(result).toHaveLength(2)
    for (const color of result) {
      expect(Math.min(distance(color, red), distance(color, green))).toBeLessThan(15)
    }
  })

  it('rejects degenerate inputs instead of throwing', () => {
    expect(quantize([], 5)).toEqual([])
    expect(quantize([[1, 2, 3]], 1)).toEqual([])
  })

  it('terminates on a single-bucket image asked for many colors', () => {
    const pixels: PixelRgb[] = Array<PixelRgb>(50).fill([10, 10, 10])
    const result = quantize(pixels, 64)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(64)
  })
})

describe('samplePixels', () => {
  it('drops near-white pixels', () => {
    const data = makeImageData([
      [[255, 255, 255], 10],
      [[251, 252, 253], 10],
      [[10, 20, 30], 10]
    ])
    const pixels = samplePixels(data, 1)

    expect(pixels).toHaveLength(10)
    expect(pixels.every(([r]) => r === 10)).toBe(true)
  })

  it('drops mostly-transparent pixels', () => {
    const data = new Uint8ClampedArray([
      10,
      20,
      30,
      255, // opaque, kept
      40,
      50,
      60,
      124, // below the 125 threshold, dropped
      70,
      80,
      90,
      125 // exactly at the threshold, kept
    ])
    const pixels = samplePixels(data, 1)

    expect(pixels).toEqual([
      [10, 20, 30],
      [70, 80, 90]
    ])
  })

  it('honours the quality stride', () => {
    const data = makeImageData([[[10, 20, 30], 100]])
    expect(samplePixels(data, 1)).toHaveLength(100)
    expect(samplePixels(data, 10)).toHaveLength(10)
  })
})

describe('extractPalette', () => {
  it('returns hex strings', () => {
    const data = makeImageData([
      [[220, 20, 20], 300],
      [[20, 20, 220], 300]
    ])
    const palette = extractPalette(data, 2, 1)

    expect(palette).toHaveLength(2)
    for (const hex of palette) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('yields nothing for an all-white image', () => {
    const data = makeImageData([[[255, 255, 255], 100]])
    expect(extractPalette(data, 5, 1)).toEqual([])
  })
})

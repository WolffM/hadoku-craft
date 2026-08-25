import { describe, it, expect } from 'vitest'
import { averageAt, cropRegion, type RgbaImage } from './sampling'

/** Build an image whose pixel at (x, y) is produced by `fill`. */
function makeImage(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number]
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y)
      const offset = (y * width + x) * 4
      data[offset] = r
      data[offset + 1] = g
      data[offset + 2] = b
      data[offset + 3] = 255
    }
  }
  return { data, width, height }
}

describe('averageAt', () => {
  it('returns the exact color on a uniform image', () => {
    const image = makeImage(10, 10, () => [40, 80, 120])
    expect(averageAt(image, 5, 5)).toEqual({ r: 40, g: 80, b: 120 })
  })

  it('averages a 3x3 block', () => {
    // Centre column 0, everything else 90: 3 of 9 pixels are 0, 6 are 90.
    const image = makeImage(3, 3, x => (x === 1 ? [0, 0, 0] : [90, 90, 90]))
    expect(averageAt(image, 1, 1)).toEqual({ r: 60, g: 60, b: 60 })
  })

  it('skips out-of-bounds neighbours rather than counting them as black', () => {
    const image = makeImage(4, 4, () => [100, 100, 100])
    // The corner has only 4 real neighbours; a naive implementation that
    // treated the missing 5 as zero would report 44, not 100.
    expect(averageAt(image, 0, 0)).toEqual({ r: 100, g: 100, b: 100 })
  })

  it('returns null when the centre is outside the image', () => {
    const image = makeImage(4, 4, () => [10, 10, 10])
    expect(averageAt(image, -1, 2)).toBeNull()
    expect(averageAt(image, 2, -1)).toBeNull()
    expect(averageAt(image, 4, 2)).toBeNull()
    expect(averageAt(image, 2, 4)).toBeNull()
  })

  it('floors fractional coordinates', () => {
    const image = makeImage(4, 1, x => [x * 10, 0, 0])
    expect(averageAt(image, 2.9, 0.4, 0)).toEqual({ r: 20, g: 0, b: 0 })
  })

  it('honours a zero radius as a single-pixel read', () => {
    const image = makeImage(3, 3, x => (x === 1 ? [0, 0, 0] : [90, 90, 90]))
    expect(averageAt(image, 1, 1, 0)).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('cropRegion', () => {
  it('extracts the requested rectangle', () => {
    const image = makeImage(4, 4, (x, y) => [x * 10, y * 10, 0])
    const crop = cropRegion(image, { x: 1, y: 1, width: 2, height: 2 })

    expect(crop).not.toBeNull()
    expect(crop!.width).toBe(2)
    expect(crop!.height).toBe(2)
    // Top-left of the crop is source pixel (1, 1).
    expect([crop!.data[0], crop!.data[1]]).toEqual([10, 10])
    // Bottom-right of the crop is source pixel (2, 2).
    const last = (1 * 2 + 1) * 4
    expect([crop!.data[last], crop!.data[last + 1]]).toEqual([20, 20])
  })

  it('clamps a region that runs off the edge', () => {
    const image = makeImage(4, 4, () => [1, 2, 3])
    const crop = cropRegion(image, { x: 2, y: 2, width: 10, height: 10 })

    expect(crop!.width).toBe(2)
    expect(crop!.height).toBe(2)
  })

  it('clamps a region starting before the origin', () => {
    const image = makeImage(4, 4, () => [1, 2, 3])
    const crop = cropRegion(image, { x: -3, y: -3, width: 5, height: 5 })

    expect(crop!.width).toBe(2)
    expect(crop!.height).toBe(2)
  })

  it('returns null when the region misses the image entirely', () => {
    const image = makeImage(4, 4, () => [1, 2, 3])
    expect(cropRegion(image, { x: 10, y: 10, width: 5, height: 5 })).toBeNull()
    expect(cropRegion(image, { x: 0, y: 0, width: 0, height: 4 })).toBeNull()
  })

  it('produces a fully opaque buffer of the right length', () => {
    const image = makeImage(6, 6, () => [7, 8, 9])
    const crop = cropRegion(image, { x: 1, y: 1, width: 3, height: 2 })

    expect(crop!.data).toHaveLength(3 * 2 * 4)
    for (let i = 3; i < crop!.data.length; i += 4) {
      expect(crop!.data[i]).toBe(255)
    }
  })
})

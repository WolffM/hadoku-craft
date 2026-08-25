/**
 * Reading pixels out of a decoded image.
 *
 * The standalone palette picker built a full-size scratch canvas and called
 * getImageData once per pixel on every click — nine canvas round-trips per
 * sample, on a canvas it rebuilt each time. Here the RGBA buffer is read out
 * once when the image loads and every later sample is plain array indexing,
 * which also makes all of this testable without a canvas.
 */

import type { Rgb } from './color'

export interface RgbaImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Average the (2*radius+1)^2 block centred on (x, y).
 *
 * Averaging beats reading the single pixel under the cursor: photographs are
 * noisy and JPEG artifacts routinely put an outlier exactly where someone
 * clicked. Out-of-bounds neighbours are skipped rather than clamped, so an
 * edge sample averages only real pixels.
 *
 * Returns null when the centre itself is outside the image.
 */
export function averageAt(image: RgbaImage, x: number, y: number, radius = 1): Rgb | null {
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) return null

  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = cx + dx
      const py = cy + dy
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue

      const offset = (py * image.width + px) * 4
      r += image.data[offset]
      g += image.data[offset + 1]
      b += image.data[offset + 2]
      count++
    }
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  }
}

/**
 * Copy a rectangular region out of `image`.
 *
 * The region is clamped to the image first, so a crop drag that runs off the
 * edge of the canvas still yields the part that overlaps rather than failing.
 * Returns null when nothing overlaps.
 */
export function cropRegion(image: RgbaImage, region: Region): RgbaImage | null {
  const x1 = Math.max(0, Math.floor(region.x))
  const y1 = Math.max(0, Math.floor(region.y))
  const x2 = Math.min(image.width, Math.floor(region.x + region.width))
  const y2 = Math.min(image.height, Math.floor(region.y + region.height))

  const width = x2 - x1
  const height = y2 - y1
  if (width <= 0 || height <= 0) return null

  const data = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    const from = ((y1 + row) * image.width + x1) * 4
    data.set(image.data.subarray(from, from + width * 4), row * width * 4)
  }

  return { data, width, height }
}

/**
 * Read an image element's pixels into a plain RGBA buffer.
 *
 * Throws rather than returning null on a missing 2D context: every caller
 * would only rethrow, and the message is the one worth surfacing.
 */
export function readImagePixels(image: HTMLImageElement): RgbaImage {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not get a 2D canvas context to read image pixels')

  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  return { data: imageData.data, width: canvas.width, height: canvas.height }
}

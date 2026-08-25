/**
 * Modified median-cut colour quantization (MMCQ).
 *
 * This replaces the ColorThief CDN script the standalone palette picker used
 * to load. A published library cannot pull a `<script>` off cdnjs — and the
 * only thing that script was ever asked for was `getPalette()`, which is this
 * algorithm. Porting it in removes the network dependency, makes the extractor
 * unit-testable under vitest, and lifts ColorThief's hard clamp of 20 colours
 * so a prefill can fill all 21 palette slots.
 *
 * The algorithm (Leptonica's MMCQ, as popularised by Nick Rabinowitz's
 * quantize.js):
 *   1. Bucket every sampled pixel into a 5-bit-per-channel histogram.
 *   2. Start with one box spanning every occupied bucket.
 *   3. Repeatedly split the box with the most PIXELS until 3/4 of the target
 *      count is reached, then switch to splitting by pixels x volume for the
 *      remainder. The two passes matter: population alone chases large flat
 *      regions and misses small saturated ones, volume alone chases noise.
 *   4. Each split cuts the box's longest axis at its weighted median.
 *   5. Report each surviving box's pixel-weighted average colour.
 */

import { rgbToHex, type Hex } from './color'

/** Bits kept per channel. 5 => a 32x32x32 = 32768-bucket histogram. */
const SIGBITS = 5
const RSHIFT = 8 - SIGBITS
const HIST_SIZE = 1 << (3 * SIGBITS)
/** Multiplier back from a bucket index to the 0–255 channel range. */
const MULT = 1 << RSHIFT
/** Fraction of the target reached by population before switching sort key. */
const FRACT_BY_POPULATION = 0.75
/** Backstop so a degenerate image cannot spin the split loop forever. */
const MAX_ITERATIONS = 1000

export type PixelRgb = readonly [number, number, number]

interface VBox {
  r1: number
  r2: number
  g1: number
  g2: number
  b1: number
  b2: number
}

const colorIndex = (r: number, g: number, b: number): number =>
  (r << (2 * SIGBITS)) + (g << SIGBITS) + b

const copyBox = (v: VBox): VBox => ({ ...v })

const volume = (v: VBox): number => (v.r2 - v.r1 + 1) * (v.g2 - v.g1 + 1) * (v.b2 - v.b1 + 1)

function countPixels(histo: Uint32Array, v: VBox): number {
  let total = 0
  for (let i = v.r1; i <= v.r2; i++) {
    for (let j = v.g1; j <= v.g2; j++) {
      for (let k = v.b1; k <= v.b2; k++) {
        total += histo[colorIndex(i, j, k)]
      }
    }
  }
  return total
}

/** Pixel-weighted mean colour of a box; box midpoint when the box is empty. */
function averageColor(histo: Uint32Array, v: VBox): PixelRgb {
  let total = 0
  let rsum = 0
  let gsum = 0
  let bsum = 0

  for (let i = v.r1; i <= v.r2; i++) {
    for (let j = v.g1; j <= v.g2; j++) {
      for (let k = v.b1; k <= v.b2; k++) {
        const hval = histo[colorIndex(i, j, k)]
        if (hval === 0) continue
        total += hval
        // +0.5 recentres the bucket: index i covers [i*MULT, (i+1)*MULT).
        rsum += hval * (i + 0.5) * MULT
        gsum += hval * (j + 0.5) * MULT
        bsum += hval * (k + 0.5) * MULT
      }
    }
  }

  if (total > 0) {
    return [Math.floor(rsum / total), Math.floor(gsum / total), Math.floor(bsum / total)]
  }
  return [
    Math.floor((MULT * (v.r1 + v.r2 + 1)) / 2),
    Math.floor((MULT * (v.g1 + v.g2 + 1)) / 2),
    Math.floor((MULT * (v.b1 + v.b2 + 1)) / 2)
  ]
}

function buildHistogram(pixels: readonly PixelRgb[]): Uint32Array {
  const histo = new Uint32Array(HIST_SIZE)
  for (const [r, g, b] of pixels) {
    histo[colorIndex(r >> RSHIFT, g >> RSHIFT, b >> RSHIFT)]++
  }
  return histo
}

function boxFromPixels(pixels: readonly PixelRgb[]): VBox {
  let r1 = Number.MAX_SAFE_INTEGER
  let r2 = 0
  let g1 = Number.MAX_SAFE_INTEGER
  let g2 = 0
  let b1 = Number.MAX_SAFE_INTEGER
  let b2 = 0

  for (const [r, g, b] of pixels) {
    const rv = r >> RSHIFT
    const gv = g >> RSHIFT
    const bv = b >> RSHIFT
    if (rv < r1) r1 = rv
    if (rv > r2) r2 = rv
    if (gv < g1) g1 = gv
    if (gv > g2) g2 = gv
    if (bv < b1) b1 = bv
    if (bv > b2) b2 = bv
  }

  return { r1, r2, g1, g2, b1, b2 }
}

/**
 * Cut one box in two along its longest axis, at the plane where the running
 * pixel count crosses half the box's total.
 *
 * Returns a single-element array when the box holds one bucket and cannot be
 * split, and an empty array when the median lands somewhere unsplittable.
 */
function medianCut(histo: Uint32Array, vbox: VBox): VBox[] {
  const count = countPixels(histo, vbox)
  if (count === 0) return []
  if (count === 1) return [copyBox(vbox)]

  const rw = vbox.r2 - vbox.r1 + 1
  const gw = vbox.g2 - vbox.g1 + 1
  const bw = vbox.b2 - vbox.b1 + 1
  const maxw = Math.max(rw, gw, bw)

  // Running pixel count along the chosen axis, indexed by that axis' value.
  const partialsum = new Map<number, number>()
  let total = 0

  const accumulate = (
    outer: [number, number],
    mid: [number, number],
    inner: [number, number],
    at: (o: number, m: number, i: number) => number
  ): void => {
    for (let o = outer[0]; o <= outer[1]; o++) {
      let sum = 0
      for (let m = mid[0]; m <= mid[1]; m++) {
        for (let i = inner[0]; i <= inner[1]; i++) {
          sum += histo[at(o, m, i)]
        }
      }
      total += sum
      partialsum.set(o, total)
    }
  }

  let axis: 'r' | 'g' | 'b'
  if (maxw === rw) {
    axis = 'r'
    accumulate([vbox.r1, vbox.r2], [vbox.g1, vbox.g2], [vbox.b1, vbox.b2], (o, m, i) =>
      colorIndex(o, m, i)
    )
  } else if (maxw === gw) {
    axis = 'g'
    accumulate([vbox.g1, vbox.g2], [vbox.r1, vbox.r2], [vbox.b1, vbox.b2], (o, m, i) =>
      colorIndex(m, o, i)
    )
  } else {
    axis = 'b'
    accumulate([vbox.b1, vbox.b2], [vbox.r1, vbox.r2], [vbox.g1, vbox.g2], (o, m, i) =>
      colorIndex(m, i, o)
    )
  }

  const lo = axis === 'r' ? vbox.r1 : axis === 'g' ? vbox.g1 : vbox.b1
  const hi = axis === 'r' ? vbox.r2 : axis === 'g' ? vbox.g2 : vbox.b2
  const setLo = (v: VBox, n: number): void => {
    if (axis === 'r') v.r1 = n
    else if (axis === 'g') v.g1 = n
    else v.b1 = n
  }
  const setHi = (v: VBox, n: number): void => {
    if (axis === 'r') v.r2 = n
    else if (axis === 'g') v.g2 = n
    else v.b2 = n
  }
  const sumAt = (n: number): number => partialsum.get(n) ?? 0

  for (let i = lo; i <= hi; i++) {
    if (sumAt(i) <= total / 2) continue

    const left = i - lo
    const right = hi - i
    // Bias the cut toward the middle of the wider half so neither child ends
    // up a sliver — a sliver would immediately be re-split and waste a slot.
    let d2 =
      left <= right
        ? Math.min(hi - 1, Math.floor(i + right / 2))
        : Math.max(lo, Math.floor(i - 1 - left / 2))

    // Never leave a zero-count box behind: walk to a plane that holds pixels.
    while (d2 < hi && sumAt(d2) === 0) d2++
    let count2 = total - sumAt(d2)
    while (count2 === 0 && d2 > lo && sumAt(d2 - 1) > 0) {
      d2--
      count2 = total - sumAt(d2)
    }

    const box1 = copyBox(vbox)
    const box2 = copyBox(vbox)
    setHi(box1, d2)
    setLo(box2, d2 + 1)
    return [box1, box2]
  }

  return []
}

/**
 * Reduce `pixels` to at most `maxColors` representative colours.
 *
 * Returns them most-significant first, so index 0 is the colour the image is
 * "about" — the advanced prefill relies on that ordering to pick its primary.
 */
export function quantize(pixels: readonly PixelRgb[], maxColors: number): PixelRgb[] {
  if (pixels.length === 0 || maxColors < 2) return []

  const histo = buildHistogram(pixels)
  const boxes: VBox[] = [boxFromPixels(pixels)]
  // Boxes that cannot be cut any further — one occupied bucket, nothing to
  // divide. Held aside so the split loop stops reconsidering them, and so an
  // image with fewer colours than `maxColors` terminates instead of spinning.
  // Splittability is a property of the box's contents, not of the weight, so
  // a box retired in the first pass stays retired in the second.
  const terminal: VBox[] = []

  // Split the currently "worst" box until `target` boxes exist; `weight`
  // decides what worst means.
  const splitUntil = (target: number, weight: (v: VBox) => number): void => {
    let iterations = 0
    while (boxes.length + terminal.length < target && iterations < MAX_ITERATIONS) {
      iterations++
      boxes.sort((a, b) => weight(a) - weight(b))
      const candidate = boxes.pop()
      if (!candidate) return

      // Empty halves are discarded rather than kept. An empty box has no
      // pixels to average, so averageColor would fall back to the box's
      // geometric midpoint — a colour that appears nowhere in the image. Left
      // in, a two-colour graphic asked for 21 swatches reports five.
      const parts = medianCut(histo, candidate).filter(v => countPixels(histo, v) > 0)
      if (parts.length < 2) {
        terminal.push(candidate)
        continue
      }
      boxes.push(...parts)
    }
  }

  splitUntil(Math.max(2, Math.floor(FRACT_BY_POPULATION * maxColors)), v => countPixels(histo, v))
  splitUntil(maxColors, v => countPixels(histo, v) * volume(v))

  return [...boxes, ...terminal]
    .map(v => ({ box: v, weight: countPixels(histo, v) * volume(v) }))
    .sort((a, b) => b.weight - a.weight)
    .map(({ box }) => averageColor(histo, box))
}

/**
 * Sample an image's pixels for quantization.
 *
 * `quality` is a stride: 10 reads every tenth pixel, which is what makes this
 * fast enough to run synchronously on a full-resolution photo. Near-white and
 * mostly-transparent pixels are dropped — they are almost always background
 * and would otherwise dominate the histogram.
 */
export function samplePixels(imageData: Uint8ClampedArray, quality = 10): PixelRgb[] {
  const pixelCount = imageData.length / 4
  const pixels: PixelRgb[] = []

  for (let i = 0; i < pixelCount; i += quality) {
    const offset = i * 4
    const r = imageData[offset]
    const g = imageData[offset + 1]
    const b = imageData[offset + 2]
    const a = imageData[offset + 3]

    if (a < 125) continue
    if (r > 250 && g > 250 && b > 250) continue
    pixels.push([r, g, b])
  }

  return pixels
}

/** Extract up to `maxColors` hex swatches from raw RGBA image data. */
export function extractPalette(
  imageData: Uint8ClampedArray,
  maxColors: number,
  quality = 10
): Hex[] {
  const pixels = samplePixels(imageData, quality)
  return quantize(pixels, maxColors).map(([r, g, b]) => rgbToHex(r, g, b))
}

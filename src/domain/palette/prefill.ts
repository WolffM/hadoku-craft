/**
 * The two automatic palette-building strategies.
 *
 * Standard treats the image as a source of dominant colours and takes the top
 * MAX_COLORS of them. Advanced treats it as a source of a colour *system*: a
 * handful of bases, each expanded into tonal variations, which is what you
 * actually want when the palette is going to become a theme rather than a
 * swatch reference.
 */

import { createColorVariations, hexToRgb, rgbToHex, type Hex } from './color'
import { extractPalette, quantize, samplePixels } from './quantize'
import { ADVANCED_BASE_COUNT, MAX_COLORS, SAMPLE_QUALITY } from './constants'
import type { RgbaImage } from './sampling'

export type PrefillKind = 'standard' | 'advanced'

/**
 * Drop repeats, keeping first occurrence.
 *
 * Quantization always returns exactly as many boxes as asked for, so an image
 * with fewer distinct colours than the target gets its flat regions split into
 * several boxes that all average to the same value. Asking a flat graphic for
 * 21 colours then yields a run of identical swatches, which wastes palette
 * slots and reads as a bug. Fewer, distinct colours is the honest answer.
 */
function dedupe(colors: readonly Hex[]): Hex[] {
  return [...new Set(colors)]
}

/** Dominant colours, most significant first. */
export function prefillStandard(image: RgbaImage, maxColors = MAX_COLORS): Hex[] {
  return dedupe(extractPalette(image.data, maxColors, SAMPLE_QUALITY))
}

/**
 * A 5 + 16 colour system: the primary base plus four variations, then four
 * secondary bases plus three variations each — 21 colours exactly.
 *
 * The primary gets the extra (more-saturated) variation because it is the one
 * a design actually leans on; the secondaries only need light/dark/muted.
 * Colours stay grouped by base rather than interleaved, so the sidebar reads
 * as five families even before the hue sort reorders it.
 */
export function prefillAdvanced(image: RgbaImage, maxColors = MAX_COLORS): Hex[] {
  const pixels = samplePixels(image.data, SAMPLE_QUALITY)
  const bases = quantize(pixels, ADVANCED_BASE_COUNT)

  const colors: Hex[] = []
  bases.forEach(([r, g, b], index) => {
    colors.push(rgbToHex(r, g, b))
    colors.push(...createColorVariations(r, g, b, index === 0 ? 4 : 3))
  })

  return dedupe(colors).slice(0, maxColors)
}

/**
 * True when a prefill produced something worth showing.
 *
 * An all-white or fully transparent image samples to zero pixels, and an empty
 * palette silently replacing a hand-picked one is the worst outcome — callers
 * use this to warn instead.
 */
export function isUsablePrefill(colors: readonly Hex[]): boolean {
  return colors.length > 0 && colors.every(c => hexToRgb(c) !== null)
}

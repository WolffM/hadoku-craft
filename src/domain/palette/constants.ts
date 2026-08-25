/**
 * Palette-route constants.
 */

/**
 * Palette capacity.
 *
 * 21 is not arbitrary: the exported PNG is a 7-wide grid, so 21 fills exactly
 * three rows, and the advanced prefill's 5 + 16 structure lands on it exactly.
 */
export const MAX_COLORS = 21

/** Bases the advanced prefill quantizes to before deriving variations. */
export const ADVANCED_BASE_COUNT = 5

/** Pixel stride when sampling an image for quantization. */
export const SAMPLE_QUALITY = 10

/** Smallest crop drag (in image pixels) that counts as a selection. */
export const MIN_CROP_SIZE = 10

export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 10
export const ZOOM_STEP = 0.1

/** Pointer travel (px) past which a drag is a pan, not a click-to-pick. */
export const DRAG_THRESHOLD = 2

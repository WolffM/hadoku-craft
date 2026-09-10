/**
 * Riftbound deck-editor builder.
 *
 * Turns a textarea decklist into a flat list of slots (one per card position,
 * count-expanded), each annotated with every alt-art variant we know about
 * for that name, and pre-fetches all variant images as data URLs so the
 * editor's dropdowns are instant on first interaction.
 *
 * Two indices feed this:
 *   - `riftbound-index.json`           name → lowest-numbered ID
 *   - `riftbound-index-variants.json`  name → [all IDs lowest-first]
 *
 * The "lowest-first" sort puts the plain ID before any `a`/`b` suffix, which
 * matches the user's preferred default: the black-bordered original beats
 * the full-art / showcase variants when no explicit pick is made.
 */

import { logger } from '@wolffm/logger/client'
import nameToIdRaw from './riftbound-index.json'
import nameVariantsRaw from './riftbound-index-variants.json'
import type { RiftboundDeck, RiftboundDeckSlot } from '../../../types'

const CDN_BASE = 'https://cdn.piltoverarchive.com/cards'

const nameToId: Record<string, string> = nameToIdRaw as Record<string, string>
const nameVariants: Record<string, string[]> = nameVariantsRaw as Record<string, string[]>

const ID_PATTERN = /^([A-Za-z]{2,5})-(\d{1,4})([a-z]?)$/

function extractCount(line: string): { count: number; rest: string } {
  const m = /^(\d+)[xX]?\s+(.+)$/.exec(line)
  if (m) return { count: Math.max(1, parseInt(m[1], 10)), rest: m[2].trim() }
  return { count: 1, rest: line }
}

function isSectionHeader(line: string): boolean {
  return /^[A-Z][A-Za-z ]+:\s*$/.test(line)
}

/** Normalise an ID to its canonical form (uppercase set, 3-digit number, lowercase suffix). */
function normaliseId(raw: string): string | null {
  const m = ID_PATTERN.exec(raw.trim())
  if (!m) return null
  const set = m[1].toUpperCase()
  const num = m[2].padStart(3, '0')
  const suf = m[3].toLowerCase()
  return `${set}-${num}${suf}`
}

/** Look up the name of a card whose variants list contains `id`, or null. */
function findNameForId(id: string): string | null {
  for (const [name, ids] of Object.entries(nameVariants)) {
    if (ids.includes(id)) return name
  }
  return null
}

/**
 * Parse a Riftbound decklist into slot rows, expanded by count. Each slot
 * comes with its full variants list pre-populated. Unknown names log to
 * console and are skipped (matches the existing source's behaviour).
 */
export function parseDeckForEditor(text: string): {
  slots: RiftboundDeckSlot[]
  missing: string[]
} {
  const slots: RiftboundDeckSlot[] = []
  const missing: string[] = []

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || isSectionHeader(trimmed)) continue

    const { count, rest } = extractCount(trimmed)

    // Path 1: explicit "SET-NUM" line. We still want to offer alt-art variants
    // in the dropdown, so we backsolve to the name from the variants index.
    const directId = normaliseId(rest)
    if (directId) {
      const name = findNameForId(directId) ?? ''
      const variants = name ? nameVariants[name] : [directId]
      const selectedId = variants.includes(directId) ? directId : variants[0]
      for (let i = 0; i < count; i++) {
        slots.push({ raw: trimmed, name, variants, selectedId })
      }
      continue
    }

    // Path 2: name lookup.
    const variants = nameVariants[rest]
    if (variants && variants.length > 0) {
      const selectedId = nameToId[rest] ?? variants[0]
      for (let i = 0; i < count; i++) {
        slots.push({ raw: trimmed, name: rest, variants: variants.slice(), selectedId })
      }
      continue
    }

    missing.push(trimmed)
  }

  return { slots, missing }
}

/** Fetch one variant image and return it as a data URL. */
async function fetchVariantAsDataUrl(id: string): Promise<string | null> {
  try {
    const resp = await fetch(`${CDN_BASE}/${id}.webp`, { mode: 'cors' })
    if (!resp.ok) {
      logger.debug('[riftbound-deck] Variant image not on CDN', { id, status: resp.status })
      return null
    }
    const blob = await resp.blob()
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    // Same opaque `TypeError: Failed to fetch` as the MTG source — the request
    // was refused before it left the browser, which is not the same thing as
    // the CDN not having the variant. See fetchJson in ./mtg.ts.
    logger.error('[riftbound-deck] Variant request could not be made', {
      id,
      error: String(error)
    })
    return null
  }
}

/**
 * Pre-fetch every unique variant image referenced by `slots`. Returns a
 * map of id → data URL (entries are absent for variants that 404'd).
 *
 * Concurrency is capped so we don't open 200 sockets at once on a deck
 * with many alt-art variants.
 */
export async function prefetchVariantImages(
  slots: RiftboundDeckSlot[],
  onProgress?: (current: number, total: number) => void,
  concurrency = 6
): Promise<Record<string, string>> {
  const allIds = new Set<string>()
  for (const slot of slots) {
    for (const id of slot.variants) allIds.add(id)
  }
  const ids = Array.from(allIds)
  const cache: Record<string, string> = {}

  let cursor = 0
  let done = 0
  const total = ids.length

  async function worker(): Promise<void> {
    while (cursor < total) {
      const i = cursor++
      const id = ids[i]
      const url = await fetchVariantAsDataUrl(id)
      if (url) cache[id] = url
      done++
      onProgress?.(done, total)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker())
  await Promise.all(workers)
  return cache
}

/**
 * Build a complete deck-editor session in one call. Parses the decklist,
 * resolves every name to its variants list, and pre-fetches every variant
 * image so the editor's per-slot dropdowns can render instantly.
 */
export async function buildRiftboundDeck(
  text: string,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ deck: RiftboundDeck; missing: string[] }> {
  const { slots, missing } = parseDeckForEditor(text)
  if (slots.length === 0) {
    return { deck: { slots: [], variantImages: {} }, missing }
  }

  const variantImages = await prefetchVariantImages(slots, (done, total) =>
    onProgress?.(done, total, `Fetching variant ${done}/${total}`)
  )

  return { deck: { slots, variantImages }, missing }
}

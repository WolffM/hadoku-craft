/**
 * Riftbound CardSource — cdn.piltoverarchive.com.
 *
 * URL pattern: https://cdn.piltoverarchive.com/cards/{SET}-{NUM}.webp
 *   - `{SET}` is the set code (OGN = Origins, UNL = Unleashed, SFD = ..., ...)
 *   - `{NUM}` is a zero-padded 3-digit collector number
 *   - A `b` suffix (e.g. OGN-007b.webp) is the back face for transform-style
 *     cards. ~4% of cards have one; the rest 404 on `-b`.
 *
 * CORS: `Access-Control-Allow-Origin: *` is set; images are hot-linkable
 * and exportable from a tainted-free canvas.
 *
 * Deck-list format — both styles supported on the same input:
 *
 *   NAME-BASED (matches the .txt export format):
 *     Legend:                    ← section headers (ignored)
 *     1 Ahri, Nine-Tailed Fox    ← <count> <name>; resolved via baked index
 *     3 Plundering Poro
 *
 *     Champion:
 *     1 Ahri, Inquisitive
 *
 *   ID-BASED (when you know the exact printing):
 *     OGN-001
 *     3 OGN-007
 *     UNL-082a                   ← explicit front face (a/b suffix dropped)
 *
 *   Lines with neither pattern are silently skipped (works for blank lines
 *   and section headers like `MainDeck:`).
 *
 * The name-based path consults `riftbound-index.json`, a best-effort
 * mapping built by scraping ~12 public decks on piltoverarchive.com.
 * Coverage is partial; expect to add entries to the JSON as you encounter
 * missing cards. Format: `{"Card Name": "SET-NUM"}` (a/b suffix optional).
 */

import { logger } from '@wolffm/logger/client'
import type { CardEntry, CardSource, FetchedCard } from '../types'
import { loadImage } from '../../canvasUtils'
import nameToIdRaw from './riftbound-index.json'

const CDN_BASE = 'https://cdn.piltoverarchive.com/cards'

const nameToId: Record<string, string> = nameToIdRaw as Record<string, string>

interface RiftboundEntryFields {
  setCode: string
  /** Zero-padded 3-digit collector number, e.g. "001". */
  collectorNumber: string
}

type RiftboundEntry = CardEntry & RiftboundEntryFields

/** Matches "OGN-001", "OGN-007a", "OGN-007b", etc. Capture set + number (sans a/b). */
const ID_PATTERN = /^([A-Za-z]{2,5})-(\d{1,4})(?:[a-z])?$/

function extractCount(line: string): { count: number; rest: string } {
  const m = /^(\d+)[xX]?\s+(.+)$/.exec(line)
  if (m) return { count: Math.max(1, parseInt(m[1], 10)), rest: m[2].trim() }
  return { count: 1, rest: line }
}

/** Section headers from the .txt export format. */
function isSectionHeader(line: string): boolean {
  // "Legend:", "Champion:", "MainDeck:", "Battlefields:", "Rune Pool:", "Sideboard:"
  return /^[A-Z][A-Za-z ]+:\s*$/.test(line)
}

function parseId(raw: string, count: number, source: string): RiftboundEntry | null {
  const m = ID_PATTERN.exec(source)
  if (!m) return null
  return {
    raw,
    count,
    setCode: m[1].toUpperCase(),
    collectorNumber: m[2].padStart(3, '0')
  }
}

function parseLine(line: string): RiftboundEntry | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || isSectionHeader(trimmed)) return null

  const { count, rest } = extractCount(trimmed)

  // Try ID format first.
  const fromId = parseId(trimmed, count, rest)
  if (fromId) return fromId

  // Otherwise treat the rest as a card name and look it up.
  const id = nameToId[rest]
  if (id) {
    const idEntry = parseId(trimmed, count, id)
    if (idEntry) return idEntry
  }

  // Not an ID and not in the name index — skip with a warning so the user
  // can see what was missing (rather than silently dropping the card).
  logger.warn('[riftbound-source] Card not in name index', { raw: trimmed })
  return null
}

function frontUrl(setCode: string, num: string): string {
  return `${CDN_BASE}/${setCode}-${num}.webp`
}
function backUrl(setCode: string, num: string): string {
  return `${CDN_BASE}/${setCode}-${num}b.webp`
}

/**
 * Deliberately silent, unlike the equivalents in ./mtg.ts: this is called for
 * the BACK face of every card and ~96% of them legitimately 404, so logging
 * here would bury a real failure under one line per single-faced card. The
 * error that matters — no front face — is logged by `fetchCard` below.
 */
async function tryLoad(url: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(url, { crossOrigin: 'anonymous' })
  } catch {
    return null
  }
}

async function fetchCard(entry: CardEntry): Promise<FetchedCard | null> {
  const e = entry as RiftboundEntry
  // Probe front + back in parallel. Back 404s in parallel with the front
  // load for ~96% of cards, costing no user-visible delay.
  const [front, back] = await Promise.all([
    tryLoad(frontUrl(e.setCode, e.collectorNumber)),
    tryLoad(backUrl(e.setCode, e.collectorNumber))
  ])
  if (!front) {
    logger.warn('[riftbound-source] Card not found on CDN', {
      raw: e.raw,
      tried: frontUrl(e.setCode, e.collectorNumber)
    })
    return null
  }
  return back ? { front, back } : { front }
}

export const riftboundSource: CardSource = {
  id: 'riftbound',
  label: 'Riftbound',
  // Same physical dimensions as MTG until proven otherwise (most TCGs use
  // standard poker-sized cards). Update if Riftbound's spec differs.
  cardWidthInches: 2.5,
  cardHeightInches: 3.5,
  cardsPerRow: 3,
  cardsPerCol: 3,
  inputHelp:
    'Accepts either `<count> <card name>` (e.g. `3 Plundering Poro`) or `<count> SET-NUM` (e.g. `3 OGN-007`). Section headers like `MainDeck:` are ignored. Names are resolved via a baked index — add entries to `riftbound-index.json` if a card is missing.',
  placeholderExample: `Legend:
1 Ahri, Nine-Tailed Fox

MainDeck:
3 Plundering Poro
3 Scuttle Crab
2 Stellacorn Herder`,
  parseLine,
  fetchCard
}

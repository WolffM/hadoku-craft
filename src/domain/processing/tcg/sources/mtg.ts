/**
 * MTG CardSource — Scryfall API.
 *
 * Wraps the existing Scryfall fetcher + line parser into the generic
 * CardSource contract. Behaviour identical to the pre-refactor mtgMode:
 *   - Three-stage fallback: direct lookup → name search → cn search
 *   - Multi-face layouts (transform / MDFC / flip / split / reversible /
 *     double_faced_token) populate the back face
 *   - 100ms throttle between API calls (Scryfall's published guideline)
 *
 * Deck-list format:
 *   <name>, <set>, <collector#>     (set/collector# optional)
 *   <name>, <set>
 *   <name>
 *   https://scryfall.com/card/<set>/<collector#>/<...>
 *   <count> <line>                  (e.g. "3 Lightning Bolt, M10, 146")
 *   # comment                       (ignored)
 */

import { logger } from '@wolffm/logger/client'
import type { CardEntry, CardSource, FetchedCard } from '../types'
import { loadImage } from '../../canvasUtils'

const SCRYFALL_BASE = 'https://api.scryfall.com/cards'
const SCRYFALL_DELAY_MS = 100

/** Layouts where Scryfall puts art under card_faces[] */
const MULTI_FACE_LAYOUTS = new Set([
  'transform',
  'modal_dfc',
  'double_faced_token',
  'flip',
  'split',
  'reversible_card'
])

interface ScryfallImageUris {
  large?: string
  normal?: string
  png?: string
}
interface ScryfallCardFace {
  name?: string
  image_uris?: ScryfallImageUris
}
interface ScryfallCard {
  name?: string
  layout?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
}
interface ScryfallSearchResponse {
  data?: ScryfallCard[]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    // Not an error: stage 1 of the fallback chain 404s routinely on a wrong
    // set/collector# and stage 2 is expected to pick it up. Debug, not warn.
    if (!res.ok) {
      logger.debug('[mtg-source] Scryfall returned non-OK', { url, status: res.status })
      return null
    }
    return (await res.json()) as T
  } catch (error) {
    // The request never left the browser. A CSP refusal, an offline client and
    // a DNS failure all arrive here as the same opaque `TypeError: Failed to
    // fetch`, so log it rather than folding it into the null that means "no
    // such card" — swallowing this is what made a blocked connect-src read as
    // "No cards could be fetched" for a month with nothing in the console.
    logger.error('[mtg-source] Scryfall request could not be made', {
      url,
      error: String(error)
    })
    return null
  }
}

async function loadScryfallImage(url: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(url, { crossOrigin: 'anonymous' })
  } catch (error) {
    // `<img>` reports every failure as a bare error event — a 404, a CORS
    // rejection and an img-src refusal are indistinguishable here. Worth
    // logging the URL: the host is the only clue to which one it was.
    logger.error('[mtg-source] Card image failed to load', { url, error: String(error) })
    return null
  }
}

function pickImageUrl(uris?: ScryfallImageUris): string | undefined {
  return uris?.large || uris?.png || uris?.normal
}

/**
 * Fold a card name to a comparable form: accent-stripped, punctuation-free,
 * lowercase. "Lim-Dûl's Vault" and "lim duls vault" both become "limdulsvault".
 *
 * Æ/œ are spelled out because NFD does not decompose them and Scryfall does
 * use them ("Æther Vial"), which nobody types.
 */
function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Does `typed` name the card Scryfall returned?
 *
 * Multi-faced cards come back as "Front // Back", and a deck list names one
 * face, so either side counts — as does `card_faces[].name`, which is where
 * the split lives for layouts that populate it.
 *
 * Being strict is safe: a false negative just falls through to the name
 * search, which is the more trustworthy lookup anyway.
 */
export function namesMatch(
  card: { name?: string; card_faces?: { name?: string }[] },
  typed: string
): boolean {
  const want = foldName(typed)
  if (!want) return true

  const candidates: string[] = []
  if (card.name) {
    candidates.push(card.name, ...card.name.split('//'))
  }
  for (const face of card.card_faces ?? []) {
    if (face.name) candidates.push(face.name)
  }
  // No name on the payload at all — nothing to contradict, so accept it.
  if (candidates.length === 0) return true

  return candidates.some(c => foldName(c) === want)
}

function hasUsableImages(data: ScryfallCard | null): boolean {
  if (!data) return false
  return Boolean(data.image_uris || data.card_faces)
}

interface MtgEntryFields {
  url?: string
  name?: string
  setCode?: string
  collectorNumber?: string
}

type MtgEntry = CardEntry & MtgEntryFields

/**
 * Pull off an optional leading count: "3 Lightning Bolt" → [3, "Lightning Bolt"].
 * No prefix → count 1.
 */
function extractCount(line: string): { count: number; rest: string } {
  const m = /^(\d+)[xX]?\s+(.+)$/.exec(line)
  if (m) {
    return { count: Math.max(1, parseInt(m[1], 10)), rest: m[2].trim() }
  }
  return { count: 1, rest: line }
}

function parseLine(line: string): MtgEntry | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const { count, rest } = extractCount(trimmed)

  // Scryfall URL
  if (/^https?:\/\//i.test(rest)) {
    const parts = rest.split('/')
    const collectorNumber = parts[parts.length - 2]
    const setCode = parts[parts.length - 3]
    return { raw: trimmed, count, url: rest, setCode, collectorNumber }
  }

  // Comma-separated: name, set, collector#
  const parts = rest.split(',').map(p => p.trim())
  return {
    raw: trimmed,
    count,
    name: parts[0] || undefined,
    setCode: parts[1] || undefined,
    collectorNumber: parts[2] || undefined
  }
}

/**
 * Choose the result that best answers the name the user typed.
 *
 * Scryfall's search ranks by relevance, not exactness, and its first hit is
 * routinely not the card asked for: `q=Lightning Bolt` returns "Emeritus of
 * Conflict // Lightning Bolt" ahead of plain "Lightning Bolt". Taking data[0]
 * is what put a split card on the sheet.
 *
 * A whole-name match therefore outranks a face match, which outranks
 * Scryfall's own ordering.
 */
export function pickByName(results: ScryfallCard[], typed: string): ScryfallCard {
  const want = foldName(typed)
  return (
    results.find(c => c.name && foldName(c.name) === want) ??
    results.find(c => namesMatch(c, typed)) ??
    results[0]
  )
}

async function fetchCard(entry: CardEntry): Promise<FetchedCard | null> {
  const e = entry as MtgEntry
  let data: ScryfallCard | null = null

  // 1. Direct fetch by set + collector#
  if (e.setCode && e.collectorNumber) {
    const url = `${SCRYFALL_BASE}/${e.setCode.toLowerCase()}/${e.collectorNumber}`
    const direct = await fetchJson<ScryfallCard>(url)
    await sleep(SCRYFALL_DELAY_MS)

    // A collector number is easy to get wrong and the result is a valid card,
    // just the wrong one — "Lightning Bolt, M10, 150" is Panic Attack. Trust
    // the name the human typed over the number and let the search below run.
    if (direct && e.name && !namesMatch(direct, e.name)) {
      logger.warn('[mtg-source] set/collector# names a different card than the line does', {
        raw: e.raw,
        typed: e.name,
        found: direct.name,
        url
      })
    } else {
      data = direct
    }
  }

  // 2. Name search fallback
  if (!hasUsableImages(data) && e.name) {
    const name = e.name
    const q = encodeURIComponent(e.setCode ? `${name} set:${e.setCode}` : name)
    const search = await fetchJson<ScryfallSearchResponse>(`${SCRYFALL_BASE}/search?q=${q}`)
    const results = search?.data ?? []
    if (results.length > 0) data = pickByName(results, name)
    await sleep(SCRYFALL_DELAY_MS)
  }

  // 3. Collector-number search fallback. Same guard as stage 1 — this resolves
  // by number too, so without it the wrong card returns through the back door.
  if (!hasUsableImages(data) && e.setCode && e.collectorNumber) {
    const q = encodeURIComponent(`cn:${e.collectorNumber} e:${e.setCode.toLowerCase()}`)
    const search = await fetchJson<ScryfallSearchResponse>(`${SCRYFALL_BASE}/search?q=${q}`)
    const hit = search?.data?.[0]
    if (hit && (!e.name || namesMatch(hit, e.name))) data = hit
    await sleep(SCRYFALL_DELAY_MS)
  }

  if (!data) {
    logger.warn('[mtg-source] Card not found', { raw: e.raw })
    return null
  }

  if (data.layout && MULTI_FACE_LAYOUTS.has(data.layout) && data.card_faces) {
    const frontUrl = pickImageUrl(data.card_faces[0]?.image_uris)
    const backUrl = pickImageUrl(data.card_faces[1]?.image_uris)
    const front = frontUrl ? await loadScryfallImage(frontUrl) : null
    const back = backUrl ? await loadScryfallImage(backUrl) : null
    if (!front) {
      logger.warn('[mtg-source] Multi-faced card missing front', { raw: e.raw })
      return null
    }
    return back ? { front, back } : { front }
  }

  const singleUrl = pickImageUrl(data.image_uris)
  if (!singleUrl) {
    logger.warn('[mtg-source] No image_uris on card', { raw: e.raw })
    return null
  }
  const front = await loadScryfallImage(singleUrl)
  return front ? { front } : null
}

export const mtgSource: CardSource = {
  id: 'mtg',
  label: 'Magic: The Gathering',
  cardWidthInches: 2.5,
  cardHeightInches: 3.5,
  cardsPerRow: 3,
  cardsPerCol: 3,
  inputHelp:
    'One card per line. Accepts a Scryfall URL or `name, set, collector#` (set / collector# optional). Optional leading count: `3 Lightning Bolt, M10, 146`.',
  placeholderExample: `Lightning Bolt, M10, 146
3 Sol Ring, c21, 263
https://scryfall.com/card/neo/238/...`,
  parseLine,
  fetchCard
}

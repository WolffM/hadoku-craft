/**
 * fetchCard's three-stage fallback, driven against recorded Scryfall shapes.
 *
 * Split out from mtg.test.ts because it needs canvasUtils mocked at module
 * scope: fetchCard loads the art through `loadImage`, which needs a real
 * `<img>` load that happy-dom will never complete for a remote URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Echo the URL back so a test can assert WHICH card's art was loaded, not
// merely that something was.
vi.mock('../../canvasUtils', () => ({
  loadImage: vi.fn((src: string) => Promise.resolve({ src } as unknown as HTMLImageElement))
}))

const { mtgSource } = await import('./mtg')

const artOf = (slug: string) => ({ large: `https://cards.scryfall.io/large/${slug}.jpg` })
const IMAGE_URIS = artOf('generic')

/** Serve a canned response per URL substring; anything unmatched 404s. */
function mockScryfall(routes: { match: string; body: unknown }[]) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url)
      const hit = routes.find(r => url.includes(r.match))
      if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(hit.body) })
    })
  )
  return calls
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('mtgSource.fetchCard — collector number disagrees with the name', () => {
  it('returns the named card, not the one at that collector number', async () => {
    // The exact reported case: M10 150 really is Panic Attack; Lightning Bolt
    // is 146. The direct hit must be rejected and the name search believed.
    const calls = mockScryfall([
      {
        match: '/cards/m10/150',
        body: { name: 'Panic Attack', image_uris: artOf('panic-attack') }
      },
      {
        match: '/search?q=',
        body: {
          data: [{ name: 'Lightning Bolt', layout: 'normal', image_uris: artOf('lightning-bolt') }]
        }
      }
    ])

    const entry = mtgSource.parseLine('Lightning Bolt, M10, 150')
    expect(entry).not.toBeNull()
    const card = await mtgSource.fetchCard(entry!)

    // The art that got loaded is Lightning Bolt's, not Panic Attack's. This is
    // the assertion that fails without the name guard.
    expect((card?.front as unknown as { src: string }).src).toContain('lightning-bolt')
    expect(calls.some(u => u.includes('/cards/m10/150'))).toBe(true)
    expect(calls.some(u => u.includes('/search?q='))).toBe(true)
  })

  it('accepts the direct hit when the number is right', async () => {
    const calls = mockScryfall([
      { match: '/cards/m10/146', body: { name: 'Lightning Bolt', image_uris: IMAGE_URIS } }
    ])

    const entry = mtgSource.parseLine('Lightning Bolt, M10, 146')
    const card = await mtgSource.fetchCard(entry!)

    expect(card).not.toBeNull()
    // No fallback needed, so no search was issued.
    expect(calls.some(u => u.includes('/search?q='))).toBe(false)
  })

  it('trusts a Scryfall URL, which carries no name to contradict', async () => {
    const calls = mockScryfall([
      { match: '/cards/m10/150', body: { name: 'Panic Attack', image_uris: IMAGE_URIS } }
    ])

    const entry = mtgSource.parseLine('https://scryfall.com/card/m10/150/panic-attack')
    const card = await mtgSource.fetchCard(entry!)

    expect(card).not.toBeNull()
    expect(calls.some(u => u.includes('/search?q='))).toBe(false)
  })
})

describe('mtgSource.fetchCard — search ranking', () => {
  it('picks the plain card over a split card that ranks first', async () => {
    mockScryfall([
      {
        match: '/search?q=',
        body: {
          data: [
            {
              name: 'Emeritus of Conflict // Lightning Bolt',
              layout: 'prepare',
              image_uris: artOf('emeritus-split')
            },
            { name: 'Lightning Bolt', layout: 'normal', image_uris: artOf('lightning-bolt') }
          ]
        }
      }
    ])

    const entry = mtgSource.parseLine('Lightning Bolt')
    const card = await mtgSource.fetchCard(entry!)
    expect((card?.front as unknown as { src: string }).src).toContain('lightning-bolt')
  })
})

describe('mtgSource.fetchCard — nothing found', () => {
  it('returns null rather than a wrong card when every stage fails', async () => {
    mockScryfall([])
    const entry = mtgSource.parseLine('Not A Real Card, zzz, 999')
    expect(await mtgSource.fetchCard(entry!)).toBeNull()
  })
})

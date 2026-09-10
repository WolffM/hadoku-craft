import { describe, it, expect } from 'vitest'
import { mtgSource, namesMatch, pickByName } from './mtg'
import { parseDeckList } from '../types'

const parseLine = mtgSource.parseLine.bind(mtgSource)

describe('mtgSource.parseLine', () => {
  it('parses a full Scryfall URL', () => {
    const entry = parseLine('https://scryfall.com/card/m10/150/lightning-bolt')
    expect(entry).toMatchObject({
      raw: 'https://scryfall.com/card/m10/150/lightning-bolt',
      url: 'https://scryfall.com/card/m10/150/lightning-bolt',
      setCode: 'm10',
      collectorNumber: '150',
      count: 1
    })
  })

  it('parses a Scryfall URL with http (not https)', () => {
    const entry = parseLine('http://scryfall.com/card/neo/238/the-wandering-emperor')
    expect(entry?.url).toBe('http://scryfall.com/card/neo/238/the-wandering-emperor')
    expect(entry?.setCode).toBe('neo')
    expect(entry?.collectorNumber).toBe('238')
  })

  it('parses a fully-qualified comma row', () => {
    expect(parseLine('Lightning Bolt, M10, 150')).toMatchObject({
      raw: 'Lightning Bolt, M10, 150',
      name: 'Lightning Bolt',
      setCode: 'M10',
      collectorNumber: '150',
      count: 1
    })
  })

  it('parses a name + set row (no collector number)', () => {
    expect(parseLine('Sol Ring, c21')).toMatchObject({
      raw: 'Sol Ring, c21',
      name: 'Sol Ring',
      setCode: 'c21',
      collectorNumber: undefined,
      count: 1
    })
  })

  it('parses a bare name (search-only)', () => {
    expect(parseLine('Black Lotus')).toMatchObject({
      raw: 'Black Lotus',
      name: 'Black Lotus',
      setCode: undefined,
      collectorNumber: undefined,
      count: 1
    })
  })

  it('strips a leading count: "3 Lightning Bolt, M10, 150"', () => {
    expect(parseLine('3 Lightning Bolt, M10, 150')).toMatchObject({
      name: 'Lightning Bolt',
      setCode: 'M10',
      collectorNumber: '150',
      count: 3
    })
  })

  it('strips a leading count with "x" suffix: "4x Sol Ring, c21"', () => {
    expect(parseLine('4x Sol Ring, c21')).toMatchObject({
      name: 'Sol Ring',
      setCode: 'c21',
      count: 4
    })
  })

  it('trims whitespace around commas', () => {
    expect(parseLine('  Lightning Bolt  ,   M10   ,  150  ')).toMatchObject({
      name: 'Lightning Bolt',
      setCode: 'M10',
      collectorNumber: '150'
    })
  })

  it('returns null for empty lines', () => {
    expect(parseLine('')).toBeNull()
    expect(parseLine('   ')).toBeNull()
    expect(parseLine('\t')).toBeNull()
  })

  it('returns null for comment lines starting with #', () => {
    expect(parseLine('# this is a comment')).toBeNull()
    expect(parseLine('  # indented comment')).toBeNull()
  })
})

describe('parseDeckList with mtgSource', () => {
  it('parses multiple lines, skipping blanks and comments', () => {
    const input = `Lightning Bolt, M10, 150
# this is a comment

Sol Ring, c21, 263
https://scryfall.com/card/neo/238/the-wandering-emperor`

    const entries = parseDeckList(input, mtgSource)
    expect(entries).toHaveLength(3)
    expect(entries[0].name).toBe('Lightning Bolt')
    expect(entries[1].name).toBe('Sol Ring')
    expect(entries[2].url).toBe('https://scryfall.com/card/neo/238/the-wandering-emperor')
  })

  it('handles Windows CRLF line endings', () => {
    const input = 'Lightning Bolt, M10, 150\r\nSol Ring, c21, 263\r\n'
    expect(parseDeckList(input, mtgSource)).toHaveLength(2)
  })

  it('returns an empty list for empty / whitespace input', () => {
    expect(parseDeckList('', mtgSource)).toEqual([])
    expect(parseDeckList('   \n  \n\t', mtgSource)).toEqual([])
  })
})

describe('namesMatch', () => {
  it('matches an exact name', () => {
    expect(namesMatch({ name: 'Lightning Bolt' }, 'Lightning Bolt')).toBe(true)
  })

  it('ignores case, accents and punctuation', () => {
    expect(namesMatch({ name: "Lim-Dûl's Vault" }, 'lim duls vault')).toBe(true)
    expect(namesMatch({ name: 'Æther Vial' }, 'Aether Vial')).toBe(true)
  })

  it('matches either half of a split name', () => {
    const card = { name: 'Emeritus of Conflict // Lightning Bolt' }
    expect(namesMatch(card, 'Lightning Bolt')).toBe(true)
    expect(namesMatch(card, 'Emeritus of Conflict')).toBe(true)
  })

  it('matches a card_faces entry', () => {
    const card = {
      name: 'Delver of Secrets // Insectile Aberration',
      card_faces: [{ name: 'Delver of Secrets' }, { name: 'Insectile Aberration' }]
    }
    expect(namesMatch(card, 'Insectile Aberration')).toBe(true)
  })

  it('rejects a different card — the M10 150 case', () => {
    expect(namesMatch({ name: 'Panic Attack' }, 'Lightning Bolt')).toBe(false)
  })

  it('accepts a payload with no name at all (nothing to contradict)', () => {
    expect(namesMatch({}, 'Lightning Bolt')).toBe(true)
  })
})

describe('pickByName', () => {
  it('prefers the whole-name match over Scryfall relevance order', () => {
    // The live ordering for q=Lightning Bolt: the split card ranks first.
    const results = [{ name: 'Emeritus of Conflict // Lightning Bolt' }, { name: 'Lightning Bolt' }]
    expect(pickByName(results, 'Lightning Bolt').name).toBe('Lightning Bolt')
  })

  it('falls back to a face match when no whole name matches', () => {
    const results = [{ name: 'Something Else' }, { name: 'Emeritus of Conflict // Lightning Bolt' }]
    expect(pickByName(results, 'Lightning Bolt').name).toBe(
      'Emeritus of Conflict // Lightning Bolt'
    )
  })

  it('falls back to the first result when nothing matches', () => {
    const results = [{ name: 'Alpha' }, { name: 'Beta' }]
    expect(pickByName(results, 'Nonexistent Card').name).toBe('Alpha')
  })
})

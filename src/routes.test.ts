import { describe, it, expect } from 'vitest'
import { parseLocation, hrefFor, DEFAULT_ROUTE } from './routes'

describe('parseLocation', () => {
  it('resolves the mounted production paths', () => {
    expect(parseLocation('/craft')).toEqual({ base: '/craft', route: 'print' })
    expect(parseLocation('/craft/palette')).toEqual({ base: '/craft', route: 'palette' })
  })

  it('resolves the vite dev paths', () => {
    expect(parseLocation('/')).toEqual({ base: '', route: 'print' })
    expect(parseLocation('/palette')).toEqual({ base: '', route: 'palette' })
  })

  it('treats an explicit /print segment as the default route, not part of the base', () => {
    expect(parseLocation('/craft/print')).toEqual({ base: '/craft', route: 'print' })
  })

  it('ignores trailing slashes', () => {
    expect(parseLocation('/craft/')).toEqual({ base: '/craft', route: 'print' })
    expect(parseLocation('/craft/palette/')).toEqual({ base: '/craft', route: 'palette' })
  })

  it('falls back to the default route for an unknown segment', () => {
    // The whole path is the base: an unknown tail is somebody else's mount
    // point, not a Craft route we should hijack.
    expect(parseLocation('/craft/nope')).toEqual({ base: '/craft/nope', route: DEFAULT_ROUTE })
  })

  it('handles a deeper mount prefix', () => {
    expect(parseLocation('/apps/craft/palette')).toEqual({
      base: '/apps/craft',
      route: 'palette'
    })
  })
})

describe('hrefFor', () => {
  it('puts the default route at the bare base', () => {
    expect(hrefFor('/craft', 'print')).toBe('/craft')
    expect(hrefFor('', 'print')).toBe('/')
  })

  it('appends non-default routes', () => {
    expect(hrefFor('/craft', 'palette')).toBe('/craft/palette')
    expect(hrefFor('', 'palette')).toBe('/palette')
  })

  it('round-trips with parseLocation', () => {
    for (const base of ['', '/craft', '/apps/craft']) {
      for (const route of ['print', 'palette'] as const) {
        expect(parseLocation(hrefFor(base, route))).toEqual({ base, route })
      }
    }
  })
})

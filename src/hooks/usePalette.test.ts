import { describe, it, expect } from 'vitest'
import { paletteReducer, initialPaletteState, MAX_COLORS, type PaletteState } from './usePalette'

const stateWith = (colors: string[], undoStack: string[][] = []): PaletteState => ({
  colors,
  undoStack
})

describe('paletteReducer', () => {
  it('adds colors in insertion order', () => {
    let state = paletteReducer(initialPaletteState, { type: 'ADD_COLOR', color: '#ff0000' })
    state = paletteReducer(state, { type: 'ADD_COLOR', color: '#00ff00' })

    expect(state.colors).toEqual(['#ff0000', '#00ff00'])
  })

  it('refuses to exceed MAX_COLORS', () => {
    let state: PaletteState = initialPaletteState
    for (let i = 0; i < MAX_COLORS + 5; i++) {
      state = paletteReducer(state, { type: 'ADD_COLOR', color: '#ff0000' })
    }
    expect(state.colors).toHaveLength(MAX_COLORS)
  })

  it('does not record an undo snapshot for a rejected add', () => {
    let state: PaletteState = initialPaletteState
    for (let i = 0; i < MAX_COLORS; i++) {
      state = paletteReducer(state, { type: 'ADD_COLOR', color: '#ff0000' })
    }
    const before = state
    const after = paletteReducer(state, { type: 'ADD_COLOR', color: '#0000ff' })

    expect(after).toBe(before)
  })

  it('truncates an oversized SET_COLORS', () => {
    const tooMany = Array.from({ length: 40 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`)
    const state = paletteReducer(initialPaletteState, { type: 'SET_COLORS', colors: tooMany })

    expect(state.colors).toHaveLength(MAX_COLORS)
    expect(state.colors[0]).toBe(tooMany[0])
  })

  it('removes by index in insertion order', () => {
    const state = paletteReducer(stateWith(['#a00000', '#00a000', '#0000a0']), {
      type: 'REMOVE_AT',
      index: 1
    })
    expect(state.colors).toEqual(['#a00000', '#0000a0'])
  })

  it('removes the right entry when the same color appears twice', () => {
    // Insertion order is the palette's identity; the hue-sorted view is only a
    // view. Removing index 2 must drop the third entry, not the first match.
    const state = paletteReducer(stateWith(['#ff0000', '#00ff00', '#ff0000']), {
      type: 'REMOVE_AT',
      index: 2
    })
    expect(state.colors).toEqual(['#ff0000', '#00ff00'])
  })

  it('ignores an out-of-range removal', () => {
    const before = stateWith(['#ff0000'])
    expect(paletteReducer(before, { type: 'REMOVE_AT', index: 7 })).toBe(before)
    expect(paletteReducer(before, { type: 'REMOVE_AT', index: -1 })).toBe(before)
  })

  it('clears to empty and records the previous palette', () => {
    const state = paletteReducer(stateWith(['#ff0000', '#00ff00']), { type: 'CLEAR' })

    expect(state.colors).toEqual([])
    expect(state.undoStack).toEqual([['#ff0000', '#00ff00']])
  })

  it('does not burn an undo slot clearing an already-empty palette', () => {
    const before = initialPaletteState
    expect(paletteReducer(before, { type: 'CLEAR' })).toBe(before)
  })

  it('undoes the most recent change', () => {
    let state = paletteReducer(initialPaletteState, { type: 'ADD_COLOR', color: '#ff0000' })
    state = paletteReducer(state, { type: 'ADD_COLOR', color: '#00ff00' })
    state = paletteReducer(state, { type: 'UNDO' })

    expect(state.colors).toEqual(['#ff0000'])
  })

  it('undoes a prefill back to the hand-picked palette', () => {
    let state = paletteReducer(initialPaletteState, { type: 'ADD_COLOR', color: '#123456' })
    state = paletteReducer(state, {
      type: 'SET_COLORS',
      colors: ['#aaaaaa', '#bbbbbb', '#cccccc']
    })
    expect(state.colors).toHaveLength(3)

    state = paletteReducer(state, { type: 'UNDO' })
    expect(state.colors).toEqual(['#123456'])
  })

  it('undoes repeatedly back to empty, then stops', () => {
    let state = paletteReducer(initialPaletteState, { type: 'ADD_COLOR', color: '#ff0000' })
    state = paletteReducer(state, { type: 'ADD_COLOR', color: '#00ff00' })

    state = paletteReducer(state, { type: 'UNDO' })
    state = paletteReducer(state, { type: 'UNDO' })
    expect(state.colors).toEqual([])
    expect(state.undoStack).toEqual([])

    const exhausted = paletteReducer(state, { type: 'UNDO' })
    expect(exhausted).toBe(state)
  })

  it('caps the undo stack at 10 snapshots', () => {
    let state: PaletteState = initialPaletteState
    for (let i = 0; i < 15; i++) {
      state = paletteReducer(state, {
        type: 'ADD_COLOR',
        color: `#0000${i.toString(16).padStart(2, '0')}`
      })
    }
    expect(state.undoStack).toHaveLength(10)

    // The oldest snapshots fell off, so undoing all 10 cannot reach empty.
    for (let i = 0; i < 10; i++) state = paletteReducer(state, { type: 'UNDO' })
    expect(state.colors).toHaveLength(5)
    expect(state.undoStack).toEqual([])
  })

  it('treats a no-op SET_COLORS as no change', () => {
    const before = stateWith(['#ff0000', '#00ff00'])
    const after = paletteReducer(before, {
      type: 'SET_COLORS',
      colors: ['#ff0000', '#00ff00']
    })
    expect(after).toBe(before)
  })
})

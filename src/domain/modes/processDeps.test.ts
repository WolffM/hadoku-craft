/**
 * processDeps drift guard.
 *
 * The Process button greys out while a mode's processDeps are unchanged, so a
 * dependency a mode forgets to declare becomes a button that stays disabled
 * after a real edit — the user cannot re-run and nothing says why.
 *
 * These tests drive each mode's own settings through the real reducer and
 * assert the deps actually move. They do NOT prove completeness (nothing
 * static can), but they pin every setting that exists today.
 */

import { describe, it, expect } from 'vitest'
import { reducer, initialState } from '../../hooks/usePrintTool'
import { getMode, MODES } from './index'
import type { PrintToolState, PrintToolAction, PrintMode } from '../types'

function depsAfter(mode: PrintMode, actions: PrintToolAction[]): readonly unknown[] {
  const state = actions.reduce<PrintToolState>((s, a) => reducer(s, a), initialState)
  return getMode(mode).processDeps(state)
}

function same(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

describe('every mode declares processDeps', () => {
  it('is implemented for each registered mode', () => {
    for (const { id } of MODES) {
      const deps = getMode(id).processDeps(initialState)
      expect(Array.isArray(deps), `${id} must return an array`).toBe(true)
    }
  })

  it('is stable for an unchanged state', () => {
    for (const { id } of MODES) {
      const mode = getMode(id)
      expect(same(mode.processDeps(initialState), mode.processDeps(initialState)), id).toBe(true)
    }
  })

  it('ignores state that does not affect the output', () => {
    // isProcessing/error churn on every run; they must not re-enable Process.
    for (const { id } of MODES) {
      const before = getMode(id).processDeps(initialState)
      const after = depsAfter(id, [
        { type: 'SET_PROCESSING', payload: true },
        { type: 'SET_ERROR', payload: 'boom' }
      ])
      expect(same(before, after), id).toBe(true)
    }
  })
})

describe('tcg processDeps react to every tcg setting', () => {
  const base = getMode('tcg').processDeps(initialState)

  it('changes when the deck list changes', () => {
    expect(same(base, depsAfter('tcg', [{ type: 'SET_TCG_INPUT', payload: 'Sol Ring' }]))).toBe(
      false
    )
  })

  it('changes when the game changes', () => {
    expect(same(base, depsAfter('tcg', [{ type: 'SET_TCG_GAME', payload: 'riftbound' }]))).toBe(
      false
    )
  })

  it('changes when the input mode changes', () => {
    expect(same(base, depsAfter('tcg', [{ type: 'SET_TCG_INPUT_MODE', payload: 'custom' }]))).toBe(
      false
    )
  })

  // Cutlines default to true, so the toggle under test must be to false.
  it('changes when cutlines are toggled', () => {
    expect(same(base, depsAfter('tcg', [{ type: 'SET_TCG_CUTLINES', payload: false }]))).toBe(false)
  })
})

describe('collage and sticker processDeps react to their settings', () => {
  it('collage deps change when settings change', () => {
    const before = getMode('collage').processDeps(initialState)
    const after = depsAfter('collage', [
      { type: 'SET_COLLAGE_SETTINGS', payload: { algorithm: 'masonry' } }
    ])
    expect(same(before, after)).toBe(false)
  })

  it('sticker deps change when settings change', () => {
    const before = getMode('sticker').processDeps(initialState)
    const after = depsAfter('sticker', [{ type: 'SET_STICKER_SETTINGS', payload: { copies: 3 } }])
    expect(same(before, after)).toBe(false)
  })
})

describe('calibration processDeps react to their settings', () => {
  const base = getMode('calibration').processDeps(initialState)

  it('changes when the calibration dpi changes', () => {
    expect(
      same(base, depsAfter('calibration', [{ type: 'SET_CALIBRATION_DPI', payload: 1200 }]))
    ).toBe(false)
  })

  it('changes when the preset changes', () => {
    const after = depsAfter('calibration', [
      { type: 'SET_CALIBRATION_PRESET', payload: 'Gamma Test' }
    ])
    expect(same(base, after)).toBe(false)
  })
})

describe('simple/duplex processDeps react to layout settings', () => {
  it('simple deps change when dpi changes', () => {
    const before = getMode('simple').processDeps(initialState)
    expect(same(before, depsAfter('simple', [{ type: 'SET_DPI', payload: 600 }]))).toBe(false)
  })

  it('simple deps change when position changes', () => {
    const before = getMode('simple').processDeps(initialState)
    const after = depsAfter('simple', [{ type: 'SET_POSITION', payload: 'Top-Left' }])
    expect(same(before, after)).toBe(false)
  })

  it('duplex deps change when the paper size changes', () => {
    const before = getMode('duplex').processDeps(initialState)
    const after = depsAfter('duplex', [{ type: 'SET_PAPER_SIZE', payload: 'A4' }])
    expect(same(before, after)).toBe(false)
  })
})

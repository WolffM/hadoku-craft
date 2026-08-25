/**
 * Palette state: the swatch list, plus a bounded undo stack.
 *
 * Written as a pure reducer (mirroring usePrintTool) so the undo semantics are
 * testable without a DOM renderer. Every mutation a user could regret pushes
 * the pre-change list onto the stack. The stack holds whole palettes rather
 * than diffs — a palette is at most 21 short strings, so snapshots are cheaper
 * than the bookkeeping a diff would need.
 */

import { useCallback, useMemo, useReducer } from 'react'
import { logger } from '@wolffm/logger/client'
import type { Hex } from '../domain/palette/color'

/** Palette capacity. The export grid is 7 wide, so 21 fills exactly 3 rows. */
export const MAX_COLORS = 21

const MAX_UNDO_STACK = 10

export interface PaletteState {
  colors: Hex[]
  /** Most recent snapshot last. Capped at MAX_UNDO_STACK. */
  undoStack: Hex[][]
}

export type PaletteAction =
  | { type: 'SET_COLORS'; colors: readonly Hex[] }
  | { type: 'ADD_COLOR'; color: Hex }
  | { type: 'REMOVE_AT'; index: number }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }

export const initialPaletteState: PaletteState = {
  colors: [],
  undoStack: []
}

/** Record `previous` for undo, dropping the oldest snapshot past the cap. */
function pushUndo(stack: Hex[][], previous: Hex[]): Hex[][] {
  const grown = [...stack, previous]
  return grown.length > MAX_UNDO_STACK ? grown.slice(grown.length - MAX_UNDO_STACK) : grown
}

/**
 * Apply `colors` as a new undoable palette.
 *
 * A change that leaves the palette identical records nothing — otherwise
 * clicking "Clear All" on an empty palette would burn an undo slot.
 */
function commit(state: PaletteState, colors: Hex[]): PaletteState {
  if (colors.length === state.colors.length && colors.every((c, i) => c === state.colors[i])) {
    return state
  }
  return { colors, undoStack: pushUndo(state.undoStack, state.colors) }
}

export function paletteReducer(state: PaletteState, action: PaletteAction): PaletteState {
  switch (action.type) {
    case 'SET_COLORS':
      return commit(state, action.colors.slice(0, MAX_COLORS))

    case 'ADD_COLOR':
      if (state.colors.length >= MAX_COLORS) return state
      return commit(state, [...state.colors, action.color])

    case 'REMOVE_AT':
      if (action.index < 0 || action.index >= state.colors.length) return state
      return commit(
        state,
        state.colors.filter((_, i) => i !== action.index)
      )

    case 'CLEAR':
      return commit(state, [])

    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      return {
        colors: state.undoStack[state.undoStack.length - 1],
        undoStack: state.undoStack.slice(0, -1)
      }
    }

    default:
      return state
  }
}

export interface PaletteControl {
  colors: Hex[]
  canUndo: boolean
  isFull: boolean
  /** Replace the whole palette, capped at MAX_COLORS. Undoable. */
  setColors: (next: readonly Hex[], reason: string) => void
  /** Append one colour. No-op when the palette is full. Undoable. */
  addColor: (hex: Hex) => void
  /** Remove the colour at `index` in insertion order. Undoable. */
  removeAt: (index: number) => void
  clear: () => void
  undo: () => void
}

export function usePalette(): PaletteControl {
  const [state, dispatch] = useReducer(paletteReducer, initialPaletteState)

  const setColors = useCallback((next: readonly Hex[], reason: string) => {
    logger.info('[usePalette] Palette replaced', { reason, count: next.length })
    dispatch({ type: 'SET_COLORS', colors: next })
  }, [])

  const addColor = useCallback((hex: Hex) => {
    dispatch({ type: 'ADD_COLOR', color: hex })
  }, [])

  const removeAt = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_AT', index })
  }, [])

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  return useMemo(
    () => ({
      colors: state.colors,
      canUndo: state.undoStack.length > 0,
      isFull: state.colors.length >= MAX_COLORS,
      setColors,
      addColor,
      removeAt,
      clear,
      undo
    }),
    [state.colors, state.undoStack.length, setColors, addColor, removeAt, clear, undo]
  )
}

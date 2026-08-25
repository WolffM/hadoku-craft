/**
 * ModeSelector Component
 *
 * Tab strip across the top of the tool. Driven by the mode registry —
 * adding a new mode in `src/domain/modes/registry.ts` adds a tab here for
 * free.
 */

import type { PrintMode } from '../../domain/types'
import { MODES } from '../../domain/modes'

interface ModeSelectorProps {
  mode: PrintMode
  onModeChange: (mode: PrintMode) => void
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="craft-mode-selector" role="tablist">
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          type="button"
          className={`craft-mode-selector__button ${
            mode === id ? 'craft-mode-selector__button--active' : ''
          }`}
          aria-selected={mode === id}
          onClick={() => onModeChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

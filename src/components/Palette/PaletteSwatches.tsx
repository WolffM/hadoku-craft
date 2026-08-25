/**
 * The palette sidebar: every picked colour, sorted by hue.
 *
 * Hue order is a view. Entries carry their insertion index so removing a
 * swatch removes the one that was clicked even when the same hex appears more
 * than once — see sortEntriesByHue.
 */

import { sortEntriesByHue, contrastingInk, type Hex } from '../../domain/palette/color'
import { MAX_COLORS } from '../../domain/palette/constants'

interface PaletteSwatchesProps {
  colors: readonly Hex[]
  onCopyColor: (hex: Hex) => void
  onRemove: (index: number) => void
}

export function PaletteSwatches({ colors, onCopyColor, onRemove }: PaletteSwatchesProps) {
  const entries = sortEntriesByHue(colors)

  return (
    <aside className="craft-palette-swatches">
      <h3 className="craft-palette-swatches__title">Color Palette</h3>
      <div className="craft-palette-swatches__count">
        {colors.length} / {MAX_COLORS} colors
      </div>

      {entries.length === 0 ? (
        <p className="craft-palette-swatches__empty">
          No colors yet. Click the image to sample one, or use a prefill.
        </p>
      ) : (
        <ul className="craft-palette-swatches__grid">
          {entries.map(({ hex, index }) => (
            <li key={`${hex}-${index}`} className="craft-palette-swatches__item">
              <button
                type="button"
                className="craft-palette-swatches__swatch"
                // The swatch IS the colour — it cannot come from a token, and
                // its label has to stay legible on whatever the user picked.
                style={{ backgroundColor: hex, color: contrastingInk(hex) }}
                onClick={() => {
                  onCopyColor(hex)
                }}
                title={`Copy ${hex.toUpperCase()}`}
              >
                <span className="craft-palette-swatches__hex">{hex.toUpperCase()}</span>
              </button>

              <button
                type="button"
                className="craft-palette-swatches__remove"
                aria-label={`Remove ${hex.toUpperCase()}`}
                title="Remove color"
                onClick={() => {
                  onRemove(index)
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

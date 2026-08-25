/**
 * Palette toolbar.
 *
 * The original hid each control until it became relevant, so buttons popped
 * into existence mid-session and shifted everything beside them. Here the
 * whole bar appears once an image is loaded and individual controls disable
 * instead — the layout stops moving, and a disabled control with a tooltip
 * still tells you what it would do.
 */

import type { PrefillKind } from '../../domain/palette/prefill'

interface PaletteToolbarProps {
  hasImage: boolean
  hasColors: boolean
  canUndo: boolean
  isCropping: boolean
  zoom: number
  onUpload: () => void
  onPrefill: (kind: PrefillKind) => void
  onStartCrop: (kind: PrefillKind) => void
  onCancelCrop: () => void
  onCopy: () => void
  onExportImage: () => void
  onUndo: () => void
  onClear: () => void
}

const CropIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </svg>
)

export function PaletteToolbar({
  hasImage,
  hasColors,
  canUndo,
  isCropping,
  zoom,
  onUpload,
  onPrefill,
  onStartCrop,
  onCancelCrop,
  onCopy,
  onExportImage,
  onUndo,
  onClear
}: PaletteToolbarProps) {
  return (
    <div className="craft-palette-toolbar">
      <button type="button" className="craft-palette-toolbar__btn" onClick={onUpload}>
        {hasImage ? 'Change Image' : 'Upload Image'}
      </button>

      {hasImage && (
        <>
          <div className="craft-palette-toolbar__group">
            <button
              type="button"
              className="craft-palette-toolbar__btn"
              onClick={() => {
                onPrefill('standard')
              }}
              title="Extract dominant colors from the whole image"
            >
              Prefill
            </button>
            <button
              type="button"
              className={`craft-palette-toolbar__btn craft-palette-toolbar__btn--sub ${
                isCropping ? 'craft-palette-toolbar__btn--armed' : ''
              }`}
              onClick={() => {
                onStartCrop('standard')
              }}
              title="Crop-Prefill (Ctrl+S) — extract from a selected region"
              aria-label="Crop-Prefill from a selected region"
            >
              <CropIcon />
            </button>
          </div>

          <div className="craft-palette-toolbar__group">
            <button
              type="button"
              className="craft-palette-toolbar__btn"
              onClick={() => {
                onPrefill('advanced')
              }}
              title="Build a 5 + 16 color system from the whole image"
            >
              Prefill (5+16)
            </button>
            <button
              type="button"
              className={`craft-palette-toolbar__btn craft-palette-toolbar__btn--sub ${
                isCropping ? 'craft-palette-toolbar__btn--armed' : ''
              }`}
              onClick={() => {
                onStartCrop('advanced')
              }}
              title="Crop-Prefill 5+16 (Ctrl+D) — build a system from a region"
              aria-label="Crop-Prefill 5+16 from a selected region"
            >
              <CropIcon />
            </button>
          </div>

          <button
            type="button"
            className="craft-palette-toolbar__btn"
            onClick={onCopy}
            disabled={!hasColors}
            title="Copy Palette (Ctrl+C)"
          >
            Copy Palette
          </button>

          <button
            type="button"
            className="craft-palette-toolbar__btn"
            onClick={onExportImage}
            disabled={!hasColors}
            title="Export Palette Image (Ctrl+E)"
          >
            Export Palette
          </button>

          <button
            type="button"
            className="craft-palette-toolbar__btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>

          <button
            type="button"
            className="craft-palette-toolbar__btn craft-palette-toolbar__btn--danger"
            onClick={onClear}
            disabled={!hasColors}
          >
            Clear All
          </button>
        </>
      )}

      <div className="craft-palette-toolbar__spacer" />

      {isCropping && (
        <button
          type="button"
          className="craft-palette-toolbar__btn craft-palette-toolbar__btn--danger"
          onClick={onCancelCrop}
        >
          Cancel Crop
        </button>
      )}

      {hasImage && <span className="craft-palette-toolbar__zoom">{Math.round(zoom * 100)}%</span>}
    </div>
  )
}

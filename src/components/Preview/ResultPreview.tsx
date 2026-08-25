/**
 * ResultPreview Component
 * Displays the processed output canvas with front/back toggle for duplex
 */

import { useState, useEffect, useRef } from 'react'
import type { ProcessedResult, PrintMode } from '../../domain/types'

interface ResultPreviewProps {
  result: ProcessedResult | null
  mode: PrintMode
}

export function ResultPreview({ result, mode }: ResultPreviewProps) {
  const [showBack, setShowBack] = useState(false)
  const [sheetIndex, setSheetIndex] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Reset sheet/back toggles when a new result comes in
  useEffect(() => {
    setShowBack(false)
    setSheetIndex(0)
  }, [result])

  const sheets = result?.sheets
  const activeSheet = sheets && sheets[sheetIndex] ? sheets[sheetIndex] : null

  const isDuplex = (mode === 'duplex' && result?.backCanvas) || activeSheet?.back !== undefined

  // Draw the result canvas to the preview canvas
  useEffect(() => {
    if (!result || !canvasRef.current) return

    let sourceCanvas: HTMLCanvasElement
    if (activeSheet) {
      sourceCanvas = showBack && activeSheet.back ? activeSheet.back : activeSheet.front
    } else {
      sourceCanvas = showBack && result.backCanvas ? result.backCanvas : result.frontCanvas
    }

    const previewCanvas = canvasRef.current
    const ctx = previewCanvas.getContext('2d')

    if (!ctx) return

    // Calculate preview dimensions (fit within container while maintaining aspect ratio)
    const maxWidth = 600
    const maxHeight = 400
    const aspectRatio = sourceCanvas.width / sourceCanvas.height

    let previewWidth = maxWidth
    let previewHeight = maxWidth / aspectRatio

    if (previewHeight > maxHeight) {
      previewHeight = maxHeight
      previewWidth = maxHeight * aspectRatio
    }

    previewCanvas.width = previewWidth
    previewCanvas.height = previewHeight

    // Draw scaled preview
    ctx.drawImage(sourceCanvas, 0, 0, previewWidth, previewHeight)
  }, [result, showBack, activeSheet])

  if (!result) {
    return (
      <div className="craft-result-preview craft-result-preview--empty">
        <div className="craft-result-preview__placeholder">
          <p>Process an image to see the result</p>
        </div>
      </div>
    )
  }

  const multiSheet = sheets && sheets.length > 1

  return (
    <div className="craft-result-preview">
      {multiSheet && (
        <div className="craft-result-preview__sheet-picker">
          <button
            type="button"
            className="craft-result-preview__sheet-nav"
            onClick={() => setSheetIndex(Math.max(0, sheetIndex - 1))}
            disabled={sheetIndex === 0}
            aria-label="Previous sheet"
          >
            ‹
          </button>
          <span className="craft-result-preview__sheet-label">
            Sheet {sheetIndex + 1} of {sheets.length}
          </span>
          <button
            type="button"
            className="craft-result-preview__sheet-nav"
            onClick={() => setSheetIndex(Math.min(sheets.length - 1, sheetIndex + 1))}
            disabled={sheetIndex === sheets.length - 1}
            aria-label="Next sheet"
          >
            ›
          </button>
        </div>
      )}

      {isDuplex && (
        <div className="craft-result-preview__toggle">
          <button
            type="button"
            className={`craft-result-preview__toggle-btn ${
              !showBack ? 'craft-result-preview__toggle-btn--active' : ''
            }`}
            onClick={() => setShowBack(false)}
          >
            Front
          </button>
          <button
            type="button"
            className={`craft-result-preview__toggle-btn ${
              showBack ? 'craft-result-preview__toggle-btn--active' : ''
            }`}
            onClick={() => setShowBack(true)}
          >
            Back
          </button>
        </div>
      )}

      <div className="craft-result-preview__canvas-container">
        <canvas ref={canvasRef} className="craft-result-preview__canvas" />
      </div>

      {(result.layoutInfo || isDuplex) && (
        <div className="craft-result-preview__info">
          {result.layoutInfo && (
            <>
              <span>
                {result.layoutInfo.paperW}" × {result.layoutInfo.paperH}"
              </span>
              <span>
                {result.layoutInfo.count} tiles ({result.layoutInfo.cols}×{result.layoutInfo.rows})
              </span>
            </>
          )}
          {isDuplex && <span>{showBack ? 'Back Sheet' : 'Front Sheet'}</span>}
        </div>
      )}
    </div>
  )
}

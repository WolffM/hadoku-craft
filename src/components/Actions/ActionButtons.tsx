/**
 * ActionButtons Component
 * Process and Download buttons for the print modes
 */

import { useState } from 'react'
import { logger } from '@wolffm/logger/client'
import type { PrintMode, ProcessedResult } from '../../domain/types'
import {
  downloadCanvasAsPng,
  exportToTiff,
  canvasToBase64,
  downloadBase64File,
  dataUrlToBase64
} from '../../api/craftApi'

interface ActionButtonsProps {
  mode: PrintMode
  canProcess: boolean
  /** Result on screen already reflects the current inputs — see ModeModule.processDeps. */
  isUpToDate: boolean
  isProcessing: boolean
  result: ProcessedResult | null
  dpi: number
  onProcess: () => Promise<void>
  onError: (error: string) => void
}

export function ActionButtons({
  mode,
  canProcess,
  isUpToDate,
  isProcessing,
  result,
  dpi,
  onProcess,
  onError
}: ActionButtonsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [localProcessing, setLocalProcessing] = useState(false)

  // Use local state OR parent state for processing indicator
  const showProcessing = localProcessing || isProcessing

  const handleProcess = async () => {
    setLocalProcessing(true)
    try {
      await onProcess()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed'
      onError(message)
    } finally {
      setLocalProcessing(false)
    }
  }

  const handleDownloadPng = (canvas: HTMLCanvasElement, suffix = '') => {
    const filename = result?.filename
      ? `${result.filename}${suffix}.png`
      : `print-output${suffix}.png`
    downloadCanvasAsPng(canvas, filename)
    logger.info('[ActionButtons] PNG downloaded', { filename })
  }

  const handleDownloadAllSheets = async (kind: 'png' | 'tiff') => {
    if (!result?.sheets) return
    for (let i = 0; i < result.sheets.length; i++) {
      const sheet = result.sheets[i]
      const sheetNum = i + 1
      if (kind === 'png') {
        handleDownloadPng(sheet.front, `_sheet${sheetNum}_front`)
        if (sheet.back) handleDownloadPng(sheet.back, `_sheet${sheetNum}_back`)
      } else {
        await handleDownloadTiff(sheet.front, `_sheet${sheetNum}_front`)
        if (sheet.back) await handleDownloadTiff(sheet.back, `_sheet${sheetNum}_back`)
      }
    }
  }

  const handleDownloadTiff = async (canvas: HTMLCanvasElement, suffix = '') => {
    setIsExporting(true)
    try {
      // For calibration mode, we already have a pre-generated TIFF
      if (result?.tiffDataUrl) {
        const filename = result.filename
          ? `${result.filename}.tif`
          : `calibration-sheet${suffix}.tif`
        downloadBase64File(dataUrlToBase64(result.tiffDataUrl), filename, 'image/tiff')
        logger.info('[ActionButtons] Pre-generated TIFF downloaded', { filename })
        return
      }

      // For other modes, export canvas to TIFF via API
      const base64 = canvasToBase64(canvas)
      const response = await exportToTiff(base64, dpi)

      if (response.success && response.file) {
        const filename = response.filename || `print-output${suffix}.tif`
        downloadBase64File(response.file, filename, 'image/tiff')
        logger.info('[ActionButtons] TIFF downloaded', { filename })
      } else {
        throw new Error(response.error || 'Failed to export TIFF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TIFF export failed'
      onError(message)
      logger.error('[ActionButtons] TIFF export failed', { error: message })
    } finally {
      setIsExporting(false)
    }
  }

  const isDuplex = mode === 'duplex' && result?.backCanvas

  const onProcessClick = () => {
    handleProcess().catch(() => {
      // Error handled in handleProcess
    })
  }

  const onTiffDownloadClick = (canvas: HTMLCanvasElement, suffix: string) => {
    handleDownloadTiff(canvas, suffix).catch(() => {
      // Error handled in handleDownloadTiff
    })
  }

  return (
    <div className="craft-actions">
      <div className="craft-actions__process">
        <button
          type="button"
          className="craft-actions__button craft-actions__button--primary"
          onClick={onProcessClick}
          disabled={!canProcess || showProcessing || isUpToDate}
          title={
            isUpToDate && !showProcessing
              ? 'The preview below already reflects these inputs. Change something to re-run.'
              : undefined
          }
        >
          {showProcessing ? (
            <>
              <span className="craft-actions__spinner" />
              Processing...
            </>
          ) : (
            'Process'
          )}
        </button>
        {/* A greyed button with no explanation is what made the original
            report read as "clicking it did nothing" — say why it is off. */}
        {isUpToDate && !showProcessing && (
          <p className="craft-actions__hint">Preview is up to date</p>
        )}
      </div>

      {result && result.sheets && result.sheets.length > 1 && (
        <div className="craft-actions__downloads">
          <div className="craft-actions__download-group">
            <span className="craft-actions__download-label">All {result.sheets.length} Sheets</span>
            <div className="craft-actions__download-buttons">
              <button
                type="button"
                className="craft-actions__button craft-actions__button--secondary"
                onClick={() => {
                  void handleDownloadAllSheets('png')
                }}
                disabled={isExporting}
              >
                PNG
              </button>
              <button
                type="button"
                className="craft-actions__button craft-actions__button--secondary"
                onClick={() => {
                  void handleDownloadAllSheets('tiff')
                }}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'TIFF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="craft-actions__downloads">
          <div className="craft-actions__download-group">
            <span className="craft-actions__download-label">
              {isDuplex ? 'Front Sheet' : 'Download'}
            </span>
            <div className="craft-actions__download-buttons">
              <button
                type="button"
                className="craft-actions__button craft-actions__button--secondary"
                onClick={() => handleDownloadPng(result.frontCanvas, isDuplex ? '-front' : '')}
                disabled={isExporting}
              >
                PNG
              </button>
              <button
                type="button"
                className="craft-actions__button craft-actions__button--secondary"
                onClick={() => onTiffDownloadClick(result.frontCanvas, isDuplex ? '-front' : '')}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'TIFF'}
              </button>
            </div>
          </div>

          {isDuplex && result.backCanvas && (
            <div className="craft-actions__download-group">
              <span className="craft-actions__download-label">Back Sheet</span>
              <div className="craft-actions__download-buttons">
                <button
                  type="button"
                  className="craft-actions__button craft-actions__button--secondary"
                  onClick={() => handleDownloadPng(result.backCanvas!, '-back')}
                  disabled={isExporting}
                >
                  PNG
                </button>
                <button
                  type="button"
                  className="craft-actions__button craft-actions__button--secondary"
                  onClick={() => onTiffDownloadClick(result.backCanvas!, '-back')}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'TIFF'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

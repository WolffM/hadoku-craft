/**
 * The print route: everything Craft did when it was hadoku-printTool.
 *
 * Lifted verbatim out of App.tsx when the palette route arrived — App is now
 * only the theme boundary, header and route switch, and each route owns its
 * own state. Mode selection, settings and processing are unchanged.
 */

import { useCallback, useState } from 'react'
import { logger } from '@wolffm/logger/client'
import { usePrintTool } from '../../hooks/usePrintTool'

import { ModeSelector } from '../ModeSelector/ModeSelector'
import { ResultPreview } from '../Preview/ResultPreview'
import { ActionButtons } from '../Actions/ActionButtons'
import { RiftboundDeckEditor } from '../RiftboundDeckEditor/RiftboundDeckEditor'
import { ProcessingOverlay, type ProcessingProgress } from '../Progress/ProcessingOverlay'

// Mode registry — drives the tab strip, sidebar, validation, and processing
import { getMode, type ModeActions, type ProcessingProgressUpdate } from '../../domain/modes'
import type { PrintMode } from '../../domain/types'

/** Per-element `Object.is`. See ModeModule.processDeps for why not a hash. */
function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
}

export function PrintRoute() {
  const tool = usePrintTool()
  const { state, setMode, setProcessing, setResult, setError, setCollageResult } = tool

  // Build the action bag the mode modules consume.
  const actions: ModeActions = {
    setSourceImage: tool.setSourceImage,
    setBackImage: tool.setBackImage,
    setPaperSize: tool.setPaperSize,
    setTileSize: tool.setTileSize,
    setDpi: tool.setDpi,
    setPosition: tool.setPosition,
    setCalibrationGrid: tool.setCalibrationGrid,
    setCalibrationDpi: tool.setCalibrationDpi,
    setCalibrationPreset: tool.setCalibrationPreset,
    setSelectedVariation: tool.setSelectedVariation,
    addCollageImages: tool.addCollageImages,
    removeCollageImage: tool.removeCollageImage,
    clearCollageImages: tool.clearCollageImages,
    setCollageSettings: tool.setCollageSettings,
    setTcgGame: tool.setTcgGame,
    setTcgInputMode: tool.setTcgInputMode,
    setTcgInput: tool.setTcgInput,
    setTcgCutlines: tool.setTcgCutlines,
    addTcgCustomImages: tool.addTcgCustomImages,
    removeTcgCustomImage: tool.removeTcgCustomImage,
    clearTcgCustomImages: tool.clearTcgCustomImages,
    setRiftboundDeck: tool.setRiftboundDeck,
    setRiftboundSlotVariant: tool.setRiftboundSlotVariant,
    addStickerImages: tool.addStickerImages,
    removeStickerImage: tool.removeStickerImage,
    clearStickerImages: tool.clearStickerImages,
    setStickerSettings: tool.setStickerSettings
  }

  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null)

  /**
   * The mode + inputs that produced the result currently on screen, captured
   * on the last successful run. While these still match, Process is greyed
   * out: re-running would rebuild the identical sheet.
   */
  const [processedFrom, setProcessedFrom] = useState<{
    mode: PrintMode
    deps: readonly unknown[]
  } | null>(null)

  const reportProgress = useCallback((p: ProcessingProgressUpdate | null) => {
    setProcessingProgress(p)
  }, [])

  const module_ = getMode(state.mode)
  const canProcess = module_.canProcess(state)

  // Nothing has changed since the run that produced the on-screen result.
  // Requires a result to actually be showing — after an error there is
  // nothing to be up to date with, so the button stays live for a retry.
  const isUpToDate =
    state.result !== null &&
    processedFrom !== null &&
    processedFrom.mode === state.mode &&
    sameDeps(processedFrom.deps, module_.processDeps(state))

  const handleProcess = useCallback(async () => {
    const mod = getMode(state.mode)
    if (!mod.canProcess(state)) {
      setError('Mode prerequisites not met')
      return
    }
    setProcessing(true)
    setError(null)
    try {
      const result = await mod.process({ state, reportProgress })
      // Modes that produce side-effect state (e.g. collage layout) attach it
      // to the result; we dispatch the corresponding action here.
      if (result.collageLayout) {
        setCollageResult(result.collageLayout)
      }
      setResult(result)
      // Only on success, and only from the state this run actually read —
      // recomputed here rather than captured before `process()` so a mode that
      // writes derived state mid-run is compared against what it settled on.
      setProcessedFrom({ mode: state.mode, deps: mod.processDeps(state) })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      setError(message)
      logger.error('[PrintRoute] Processing error', { error: message })
    } finally {
      setProcessing(false)
      setProcessingProgress(null)
    }
  }, [state, setProcessing, setResult, setError, setCollageResult, reportProgress])

  return (
    <>
      <ModeSelector mode={state.mode} onModeChange={setMode} />

      <div className="craft__layout">
        <div className="craft__sidebar">{module_.renderSettings({ state, actions })}</div>

        <div className="craft__main">
          {state.riftboundDeck ? (
            <RiftboundDeckEditor
              deck={state.riftboundDeck}
              cutlines={state.tcgCutlines}
              onSlotVariantChange={tool.setRiftboundSlotVariant}
              onClose={() => tool.setRiftboundDeck(null)}
            />
          ) : (
            <>
              <ResultPreview result={state.result} mode={state.mode} />

              {state.error && <div className="craft__error">{state.error}</div>}

              <ActionButtons
                mode={state.mode}
                canProcess={canProcess}
                isUpToDate={isUpToDate}
                isProcessing={state.isProcessing}
                result={state.result}
                dpi={state.mode === 'calibration' ? state.calibrationDpi : state.dpi}
                onProcess={handleProcess}
                onError={setError}
              />
            </>
          )}
        </div>
      </div>

      <ProcessingOverlay
        isVisible={state.isProcessing}
        progress={processingProgress}
        title={module_.processingTitle ?? 'Processing...'}
      />
    </>
  )
}

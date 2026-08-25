import { useRef, useState, useCallback, useEffect, type RefObject } from 'react'
import { AppHeader, LoadingSkeleton } from '@wolffm/task-ui-components'
import { useHadokuTheme, HadokuThemeRoot } from '@wolffm/themes'
import { logger } from '@wolffm/logger/client'
import { usePrintTool } from './hooks/usePrintTool'
import type { CraftProps } from './entry'

// Components
import { ModeSelector } from './components/ModeSelector/ModeSelector'
import { ResultPreview } from './components/Preview/ResultPreview'
import { ActionButtons } from './components/Actions/ActionButtons'
import { RiftboundDeckEditor } from './components/RiftboundDeckEditor/RiftboundDeckEditor'
import { ApiStatus, type ApiStatusState } from './components/ApiStatus/ApiStatus'
import { ProcessingOverlay, type ProcessingProgress } from './components/Progress/ProcessingOverlay'

// Mode registry — drives the tab strip, sidebar, validation, and processing
import { getMode, type ModeActions, type ProcessingProgressUpdate } from './domain/modes'
import { checkApiHealth } from './api/craftApi'

/**
 * Provider boundary. Theme state is the platform's (@wolffm/themes), not this
 * app's — the local hooks/useTheme.ts, prefs/themePrefs.ts and
 * app/themeConfig.tsx copies are gone. AppHeader renders the shared picker
 * from this context, so nothing below passes one.
 */
export default function App(props: CraftProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  return (
    <HadokuThemeRoot theme={props.theme} containerRef={containerRef}>
      <AppInner containerRef={containerRef} />
    </HadokuThemeRoot>
  )
}

function AppInner({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const [systemPrefersDark] = useState(() =>
    window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  )

  // Backend health indicator
  const [apiStatus, setApiStatus] = useState<ApiStatusState>('checking')
  const checkHealth = useCallback(async () => {
    setApiStatus('checking')
    const isHealthy = await checkApiHealth()
    setApiStatus(isHealthy ? 'online' : 'offline')
    logger.info('[App] API health check', { status: isHealthy ? 'online' : 'offline' })
  }, [])
  const handleRetryHealth = useCallback(() => {
    checkHealth().catch(() => {
      /* error handled inside */
    })
  }, [checkHealth])
  useEffect(() => {
    void checkHealth()
  }, [checkHealth])

  const { theme, isDarkTheme, isThemeReady, isInitialThemeLoad } = useHadokuTheme()

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

  const reportProgress = useCallback((p: ProcessingProgressUpdate | null) => {
    setProcessingProgress(p)
  }, [])

  const module_ = getMode(state.mode)
  const canProcess = module_.canProcess(state)

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      setError(message)
      logger.error('[App] Processing error', { error: message })
    } finally {
      setProcessing(false)
      setProcessingProgress(null)
    }
  }, [state, setProcessing, setResult, setError, setCollageResult, reportProgress])

  if (isInitialThemeLoad && !isThemeReady) {
    return <LoadingSkeleton isDarkTheme={systemPrefersDark} />
  }

  return (
    <div
      ref={containerRef}
      className="craft-container"
      data-theme={theme}
      data-dark-theme={isDarkTheme ? 'true' : 'false'}
    >
      <div className="craft">
        <AppHeader
          title="Hadoku Craft"
          status={<ApiStatus status={apiStatus} onRetry={handleRetryHealth} />}
        />

        <main className="craft__content">
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
        </main>
      </div>

      <ProcessingOverlay
        isVisible={state.isProcessing}
        progress={processingProgress}
        title={module_.processingTitle ?? 'Processing...'}
      />
    </div>
  )
}

/**
 * ModeModule contract.
 *
 * Each print mode declares one ModeModule. The registry (./registry.ts)
 * wires them into the app:
 *   - ModeSelector reads the list of {id, label}
 *   - usePrintTool's canProcess delegates to module.canProcess
 *   - App.tsx's handleProcess delegates to module.process
 *   - Sidebar renders module.renderSettings
 *
 * Modules can read the full PrintToolState and call any action creator.
 * Step 5 will slice state per-mode; today the contract lets modes touch
 * shared concerns (sourceImage, error, result) without imposing a slice.
 */

import type { ReactNode } from 'react'
import type { PrintMode, PrintToolState, ProcessedResult } from '../types'

export interface ProcessingProgressUpdate {
  step: number
  total: number
  message: string
}

/** Bag of action creators a mode needs to drive the UI. */
export interface ModeActions {
  setSourceImage: (image: PrintToolState['sourceImage']) => void
  setBackImage: (image: PrintToolState['backImage']) => void
  setPaperSize: (size: PrintToolState['paperSize']) => void
  setTileSize: (size: PrintToolState['tileSize']) => void
  setDpi: (dpi: number) => void
  setPosition: (position: PrintToolState['position']) => void
  setCalibrationGrid: (grid: PrintToolState['calibrationGrid']) => void
  setCalibrationDpi: (dpi: number) => void
  setCalibrationPreset: (preset: PrintToolState['calibrationPreset']) => void
  setSelectedVariation: (index: number) => void
  addCollageImages: (images: PrintToolState['collageImages']) => void
  removeCollageImage: (id: string) => void
  clearCollageImages: () => void
  setCollageSettings: (s: Partial<PrintToolState['collageSettings']>) => void
  setTcgGame: (game: PrintToolState['tcgGame']) => void
  setTcgInputMode: (m: PrintToolState['tcgInputMode']) => void
  setTcgInput: (input: string) => void
  setTcgCutlines: (on: boolean) => void
  addTcgCustomImages: (images: PrintToolState['tcgCustomImages']) => void
  removeTcgCustomImage: (id: string) => void
  clearTcgCustomImages: () => void
  setRiftboundDeck: (deck: PrintToolState['riftboundDeck']) => void
  setRiftboundSlotVariant: (slotIndex: number, variantId: string) => void
  addStickerImages: (images: PrintToolState['stickerImages']) => void
  removeStickerImage: (id: string) => void
  clearStickerImages: () => void
  setStickerSettings: (s: Partial<PrintToolState['stickerSettings']>) => void
}

export interface RenderSettingsArgs {
  state: PrintToolState
  actions: ModeActions
}

export interface ProcessArgs {
  state: PrintToolState
  /** Report progress to the floating overlay. Pass null to clear. */
  reportProgress: (p: ProcessingProgressUpdate | null) => void
}

export interface ModeModule {
  id: PrintMode
  label: string
  /** Title shown on the processing overlay (defaults to "Processing..."). */
  processingTitle?: string
  /** True when this mode has enough input to be processed. */
  canProcess: (state: PrintToolState) => boolean
  /**
   * Every piece of state this mode's `process()` reads, in a stable order.
   * PrintRoute snapshots it on a successful run and greys out Process until
   * one of them changes — re-running identical inputs can only reproduce the
   * result that is already on screen.
   *
   * Compared by `Object.is` per element, never serialised: the entries are
   * mostly image objects whose `dataUrl` is megabytes of base64, and the
   * reducer already replaces the reference on every edit. That makes identity
   * both cheaper and more accurate than a hash.
   *
   * Err towards listing too much. A missing entry leaves Process disabled
   * after a real edit, which blocks the user; a redundant one only re-enables
   * a button that was safe to press anyway.
   */
  processDeps: (state: PrintToolState) => readonly unknown[]
  /** Render the sidebar's settings panel for this mode. */
  renderSettings: (args: RenderSettingsArgs) => ReactNode
  /**
   * Run the pipeline. Returns a ProcessedResult; the caller wires it into
   * state via setResult. Throwing rejects out to setError.
   */
  process: (args: ProcessArgs) => Promise<ProcessedResult>
}

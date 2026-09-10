/**
 * Sticker mode — Python sidecar (bg removal + cutline + tile) via local server.
 */

import { logger } from '@wolffm/logger/client'
import type { ModeModule } from './types'
import { StickerSettings } from '../../components/Settings/StickerSettings'
import {
  processSticker,
  checkApiHealth,
  imageDataUrlToCanvas,
  dataUrlToBase64
} from '../../api/craftApi'

export const stickerMode: ModeModule = {
  id: 'sticker',
  label: 'Stickers',
  processingTitle: 'Running Sticker Pipeline...',

  canProcess: state => state.stickerImages.length > 0,

  processDeps: state => [state.stickerImages, state.stickerSettings],

  renderSettings: ({ state, actions }) => (
    <StickerSettings
      images={state.stickerImages}
      settings={state.stickerSettings}
      onAddImages={actions.addStickerImages}
      onRemoveImage={actions.removeStickerImage}
      onClearImages={actions.clearStickerImages}
      onSettingsChange={actions.setStickerSettings}
    />
  ),

  process: async ({ state, reportProgress }) => {
    if (state.stickerImages.length === 0) {
      throw new Error('Add at least one image')
    }

    reportProgress({
      step: 0,
      total: 1,
      message: 'Running sticker pipeline (this can take a minute)...'
    })

    const isHealthy = await checkApiHealth()
    if (!isHealthy) {
      throw new Error(
        'Local processing server is offline. Start it with: cd hadoku-craft && pnpm local:start'
      )
    }

    const settings = state.stickerSettings
    const response = await processSticker({
      images: state.stickerImages.map(img => ({
        filename: img.name,
        data: dataUrlToBase64(img.dataUrl)
      })),
      copies: settings.copies,
      size: settings.size,
      offsetInches: settings.customOffsetInches ?? undefined,
      test: settings.testMode
    })
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Sticker pipeline failed')
    }

    const previewCanvas = await imageDataUrlToCanvas(response.data.image)
    reportProgress(null)

    logger.info('[stickerMode] Sticker pipeline complete', {
      filename: response.data.filename,
      sizeBytes: response.data.sizeBytes
    })
    return {
      frontCanvas: previewCanvas,
      layoutInfo: null,
      filename: response.data.filename.replace(/\.jpg$/i, '')
    }
  }
}

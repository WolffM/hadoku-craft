/**
 * Duplex mode — front/back postcard sheets with column-mirrored backs.
 */

import type { ModeModule } from './types'
import { TilingSettings } from '../../components/Settings/TilingSettings'
import { DuplexSettings } from '../../components/Settings/DuplexSettings'
import { SourceImageSlot } from './simpleMode'
import { createDuplexSheets } from '../processing/createDuplexSheets'
import { loadImage } from '../processing/canvasUtils'

export const duplexMode: ModeModule = {
  id: 'duplex',
  label: 'Postcard Duplex',

  canProcess: state => Boolean(state.sourceImage && state.backImage && state.layoutInfo),

  processDeps: state => [
    state.sourceImage,
    state.backImage,
    state.layoutInfo,
    state.paperSize,
    state.tileSize,
    state.dpi
  ],

  renderSettings: ({ state, actions }) => {
    const frontOrientation = state.sourceImage
      ? state.sourceImage.width < state.sourceImage.height
        ? 'portrait'
        : 'landscape'
      : undefined
    return (
      <>
        <SourceImageSlot state={state} actions={actions} />
        <TilingSettings
          paperSize={state.paperSize}
          tileSize={state.tileSize}
          dpi={state.dpi}
          position={state.position}
          layoutInfo={state.layoutInfo}
          disablePosition
          onPaperSizeChange={actions.setPaperSize}
          onTileSizeChange={actions.setTileSize}
          onDpiChange={actions.setDpi}
          onPositionChange={actions.setPosition}
        />
        <DuplexSettings
          backImage={state.backImage}
          onBackImageChange={actions.setBackImage}
          frontImageOrientation={frontOrientation}
        />
      </>
    )
  },

  process: async ({ state, reportProgress }) => {
    if (!state.sourceImage || !state.backImage || !state.layoutInfo) {
      throw new Error('Duplex requires front, back, and a valid layout')
    }
    reportProgress({ step: 0, total: 2, message: 'Loading images...' })
    const [frontImg, backImg] = await Promise.all([
      loadImage(state.sourceImage.dataUrl),
      loadImage(state.backImage.dataUrl)
    ])
    reportProgress({ step: 1, total: 2, message: 'Generating duplex sheets...' })
    const { frontCanvas, backCanvas } = await createDuplexSheets({
      frontImage: frontImg,
      backImage: backImg,
      layout: state.layoutInfo,
      dpi: state.dpi
    })
    reportProgress(null)
    return {
      frontCanvas,
      backCanvas,
      layoutInfo: state.layoutInfo,
      filename: `${state.sourceImage.name.replace(/\.[^/.]+$/, '')}_duplex`
    }
  }
}

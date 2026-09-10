/**
 * Simple Tiling mode — repeats one source image in a grid on a sheet.
 */

import type { ModeModule } from './types'
import type { ImageFile } from '../types'
import { TilingSettings } from '../../components/Settings/TilingSettings'
import { ImageUpload } from '../../components/ImageUpload/ImageUpload'
import { createTiledCanvas } from '../processing/createTiledCanvas'
import { loadImage } from '../processing/canvasUtils'

export const simpleMode: ModeModule = {
  id: 'simple',
  label: 'Simple Tiling',

  canProcess: state => Boolean(state.sourceImage && state.layoutInfo),

  // paperSize/tileSize are not read directly by process() — they feed
  // layoutInfo, which is. Listed anyway so a settings change re-enables
  // Process even if layoutInfo is recomputed to an identical object.
  processDeps: state => [
    state.sourceImage,
    state.layoutInfo,
    state.paperSize,
    state.tileSize,
    state.dpi,
    state.position
  ],

  renderSettings: ({ state, actions }) => (
    <>
      <SourceImageSlot state={state} actions={actions} />
      <TilingSettings
        paperSize={state.paperSize}
        tileSize={state.tileSize}
        dpi={state.dpi}
        position={state.position}
        layoutInfo={state.layoutInfo}
        onPaperSizeChange={actions.setPaperSize}
        onTileSizeChange={actions.setTileSize}
        onDpiChange={actions.setDpi}
        onPositionChange={actions.setPosition}
      />
    </>
  ),

  process: async ({ state, reportProgress }) => {
    if (!state.sourceImage || !state.layoutInfo) {
      throw new Error('Simple tiling requires a source image and a valid layout')
    }
    reportProgress({ step: 0, total: 1, message: 'Generating tiled sheet...' })
    const sourceImg = await loadImage(state.sourceImage.dataUrl)
    const frontCanvas = await createTiledCanvas({
      sourceImage: sourceImg,
      layout: state.layoutInfo,
      dpi: state.dpi,
      position: state.position
    })
    reportProgress(null)
    return {
      frontCanvas,
      layoutInfo: state.layoutInfo,
      filename: `${state.sourceImage.name.replace(/\.[^/.]+$/, '')}_tiled`
    }
  }
}

/**
 * Source-image picker shared by simple / duplex / calibration modes. Lives
 * here so each module can render its sidebar without App.tsx tracking the
 * upload widget separately.
 */
export function SourceImageSlot({
  state,
  actions
}: {
  state: { sourceImage: ImageFile | null }
  actions: { setSourceImage: (img: ImageFile | null) => void }
}) {
  return (
    <ImageUpload
      image={state.sourceImage}
      onImageSelect={actions.setSourceImage}
      label="Source Image"
    />
  )
}

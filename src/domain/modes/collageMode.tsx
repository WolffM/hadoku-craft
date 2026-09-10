/**
 * Collage mode — pack a pool of images onto a sheet using a chosen algorithm.
 */

import type { ModeModule } from './types'
import { CollageImagePool } from '../../components/ImageUpload/CollageImagePool'
import { CollageSettings } from '../../components/Settings/CollageSettings'
import { createCollageCanvas } from '../processing/collage'

export const collageMode: ModeModule = {
  id: 'collage',
  label: 'Collage',
  processingTitle: 'Generating Collage...',

  canProcess: state => state.collageImages.length > 0,

  processDeps: state => [state.collageImages, state.collageSettings],

  renderSettings: ({ state, actions }) => (
    <>
      <CollageImagePool
        images={state.collageImages}
        layoutResult={state.collageResult}
        onAddImages={actions.addCollageImages}
        onRemoveImage={actions.removeCollageImage}
        onClearAll={actions.clearCollageImages}
      />
      <CollageSettings settings={state.collageSettings} onChange={actions.setCollageSettings} />
    </>
  ),

  process: async ({ state, reportProgress }) => {
    if (state.collageImages.length === 0) {
      throw new Error('Collage needs at least one image in the pool')
    }
    reportProgress({ step: 0, total: 1, message: 'Starting collage generation...' })

    const result = await createCollageCanvas(
      {
        images: state.collageImages,
        settings: state.collageSettings,
        seed: null
      },
      progress =>
        reportProgress({
          step: progress.step,
          total: progress.total,
          message: progress.message
        })
    )
    reportProgress(null)

    return {
      frontCanvas: result.canvas,
      collageLayout: result.layout,
      layoutInfo: null,
      filename: `collage_${state.collageSettings.algorithm}`
    }
  }
}

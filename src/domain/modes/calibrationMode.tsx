/**
 * Calibration mode — color/density variation sheet via the local ImageMagick server.
 */

import type { ModeModule } from './types'
import { CalibrationSettings } from '../../components/Settings/CalibrationSettings'
import { SourceImageSlot } from './simpleMode'
import { VARIATION_PRESETS, CALIBRATION_GRIDS } from '../constants'
import { generateCalibrationSheet, checkApiHealth, tiffToCanvas } from '../../api/craftApi'

export const calibrationMode: ModeModule = {
  id: 'calibration',
  label: 'Calibration Sheet',
  processingTitle: 'Building Calibration Sheet...',

  canProcess: state => Boolean(state.sourceImage),

  renderSettings: ({ state, actions }) => (
    <>
      <SourceImageSlot state={state} actions={actions} />
      <CalibrationSettings
        calibrationGrid={state.calibrationGrid}
        calibrationDpi={state.calibrationDpi}
        calibrationPreset={state.calibrationPreset}
        selectedVariationIndex={state.selectedVariationIndex}
        sourceImageUrl={state.sourceImage?.dataUrl}
        onGridChange={actions.setCalibrationGrid}
        onDpiChange={actions.setCalibrationDpi}
        onPresetChange={actions.setCalibrationPreset}
        onVariationSelect={actions.setSelectedVariation}
      />
    </>
  ),

  process: async ({ state, reportProgress }) => {
    if (!state.sourceImage) {
      throw new Error('Calibration requires a source image')
    }

    const isHealthy = await checkApiHealth()
    if (!isHealthy) {
      throw new Error(
        'Local processing server is offline. Start it with: cd hadoku-craft && pnpm local:start'
      )
    }

    const preset = VARIATION_PRESETS[state.calibrationPreset]
    const grid = CALIBRATION_GRIDS[state.calibrationGrid]

    const response = await generateCalibrationSheet(
      state.sourceImage.dataUrl,
      'Letter',
      [...grid] as [number, number],
      state.calibrationDpi,
      [...preset],
      progress =>
        reportProgress({
          step: progress.step,
          total: progress.total,
          message: progress.message
        })
    )
    reportProgress(null)

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Calibration failed')
    }

    const previewCanvas = await tiffToCanvas(response.data.image)
    return {
      frontCanvas: previewCanvas,
      tiffDataUrl: response.data.image,
      layoutInfo: null,
      filename: `calibration_${state.calibrationPreset.replace(/\s+/g, '_')}`
    }
  }
}

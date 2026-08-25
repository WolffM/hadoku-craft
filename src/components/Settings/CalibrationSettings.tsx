/**
 * CalibrationSettings Component
 * Settings panel for Calibration Sheet mode
 */

import type { CalibrationGridKey, VariationPresetKey, Variation } from '../../domain/types'
import { CALIBRATION_GRIDS, CALIBRATION_DPI, VARIATION_PRESETS } from '../../domain/constants'
import { getVariationPreviewStyle } from '../../domain/processing/variationFilters'
import { SettingsPanel, SettingsSection, SettingsInfo } from '../shared/SettingsPanel'

interface CalibrationSettingsProps {
  calibrationGrid: CalibrationGridKey
  calibrationDpi: number
  calibrationPreset: VariationPresetKey
  selectedVariationIndex: number
  sourceImageUrl?: string
  onGridChange: (grid: CalibrationGridKey) => void
  onDpiChange: (dpi: number) => void
  onPresetChange: (preset: VariationPresetKey) => void
  onVariationSelect: (index: number) => void
}

export function CalibrationSettings({
  calibrationGrid,
  calibrationDpi,
  calibrationPreset,
  selectedVariationIndex,
  sourceImageUrl,
  onGridChange,
  onDpiChange,
  onPresetChange,
  onVariationSelect
}: CalibrationSettingsProps) {
  const gridSize = CALIBRATION_GRIDS[calibrationGrid]
  const variations = VARIATION_PRESETS[calibrationPreset] as readonly Variation[]
  const totalCells = gridSize[0] * gridSize[1]
  const activeVariations = variations.slice(0, totalCells)

  return (
    <SettingsPanel className="craft-calibration-settings">
      <SettingsSection title="Grid Settings">
        <div className="craft-calibration-settings__group">
          <label className="craft-calibration-settings__label" htmlFor="calib-grid">
            Grid Size
          </label>
          <select
            id="calib-grid"
            className="craft-calibration-settings__select"
            value={calibrationGrid}
            onChange={e => onGridChange(e.target.value as CalibrationGridKey)}
          >
            {Object.keys(CALIBRATION_GRIDS).map(grid => (
              <option key={grid} value={grid}>
                {grid}
              </option>
            ))}
          </select>
        </div>

        <div className="craft-calibration-settings__group">
          <label className="craft-calibration-settings__label" htmlFor="calib-dpi">
            Output DPI
          </label>
          <select
            id="calib-dpi"
            className="craft-calibration-settings__select"
            value={calibrationDpi}
            onChange={e => onDpiChange(parseInt(e.target.value, 10))}
          >
            {Object.entries(CALIBRATION_DPI).map(([label, dpi]) => (
              <option key={label} value={dpi}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </SettingsSection>

      <SettingsSection title="Variation Preset">
        <div className="craft-calibration-settings__group">
          <label className="craft-calibration-settings__label" htmlFor="calib-preset">
            Preset
          </label>
          <select
            id="calib-preset"
            className="craft-calibration-settings__select"
            value={calibrationPreset}
            onChange={e => onPresetChange(e.target.value as VariationPresetKey)}
          >
            {Object.keys(VARIATION_PRESETS).map(preset => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </div>

        <div className="craft-calibration-settings__variations">
          <div className="craft-calibration-settings__variations-label">
            Variations ({activeVariations.length} of {totalCells})
          </div>
          <div className="craft-calibration-settings__variations-grid">
            {activeVariations.map((variation, index) => (
              <button
                key={index}
                type="button"
                className={`craft-calibration-settings__variation ${
                  index === selectedVariationIndex
                    ? 'craft-calibration-settings__variation--selected'
                    : ''
                }`}
                onClick={() => onVariationSelect(index)}
                title={variation.label}
              >
                {sourceImageUrl ? (
                  <div className="craft-calibration-settings__variation-preview">
                    <img
                      src={sourceImageUrl}
                      alt={variation.label}
                      style={getVariationPreviewStyle(variation.args)}
                    />
                  </div>
                ) : (
                  <div className="craft-calibration-settings__variation-placeholder" />
                )}
                <span className="craft-calibration-settings__variation-label">
                  {variation.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {selectedVariationIndex >= 0 && activeVariations[selectedVariationIndex] && (
          <div className="craft-calibration-settings__selected-info">
            <strong>Selected:</strong> {activeVariations[selectedVariationIndex].label}
            {activeVariations[selectedVariationIndex].args.length > 0 && (
              <div className="craft-calibration-settings__args">
                {activeVariations[selectedVariationIndex].args.join(' ')}
              </div>
            )}
          </div>
        )}
      </SettingsSection>

      <SettingsInfo>
        <p>
          <strong>Note:</strong> The preview shows CSS filter approximations. Final output uses
          ImageMagick for accurate color processing.
        </p>
      </SettingsInfo>
    </SettingsPanel>
  )
}

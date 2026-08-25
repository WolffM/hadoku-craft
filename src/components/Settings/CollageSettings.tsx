/**
 * CollageSettings Component
 * Settings panel for collage mode
 */

import type {
  CollageSettings as CollageSettingsType,
  CollageAlgorithm,
  CropAnchor,
  PaperSizeKey
} from '../../domain/types'
import {
  COLLAGE_ALGORITHMS,
  COLLAGE_ALGORITHM_DESCRIPTIONS,
  CROP_ANCHOR_LABELS,
  PAPER_SIZES
} from '../../domain/constants'
import { SettingsPanel } from '../shared/SettingsPanel'

interface CollageSettingsProps {
  settings: CollageSettingsType
  onChange: (settings: Partial<CollageSettingsType>) => void
}

export function CollageSettings({ settings, onChange }: CollageSettingsProps) {
  const algorithms = Object.entries(COLLAGE_ALGORITHMS) as [CollageAlgorithm, string][]
  const paperSizes = Object.keys(PAPER_SIZES) as PaperSizeKey[]

  return (
    <SettingsPanel className="craft-collage-settings">
      {/* Algorithm Selection */}
      <div className="craft-settings__group">
        <label className="craft-settings__label">Algorithm</label>
        <select
          className="craft-settings__select"
          value={settings.algorithm}
          onChange={e => onChange({ algorithm: e.target.value as CollageAlgorithm })}
        >
          {algorithms.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        <p className="craft-settings__hint">{COLLAGE_ALGORITHM_DESCRIPTIONS[settings.algorithm]}</p>
      </div>

      {/* Paper Size */}
      <div className="craft-settings__group">
        <label className="craft-settings__label">Paper Size</label>
        <select
          className="craft-settings__select"
          value={settings.paperSize}
          onChange={e => onChange({ paperSize: e.target.value as PaperSizeKey })}
        >
          {paperSizes.map(size => (
            <option key={size} value={size}>
              {size} ({PAPER_SIZES[size][0]}" x {PAPER_SIZES[size][1]}")
            </option>
          ))}
        </select>
      </div>

      {/* DPI */}
      <div className="craft-settings__group">
        <label className="craft-settings__label">Output DPI</label>
        <div className="craft-settings__radio-group">
          <label className="craft-settings__radio">
            <input
              type="radio"
              name="collageDpi"
              value={300}
              checked={settings.dpi === 300}
              onChange={() => onChange({ dpi: 300 })}
            />
            300 (Fast)
          </label>
          <label className="craft-settings__radio">
            <input
              type="radio"
              name="collageDpi"
              value={600}
              checked={settings.dpi === 600}
              onChange={() => onChange({ dpi: 600 })}
            />
            600 (Quality)
          </label>
        </div>
      </div>

      {/* Gap Size */}
      <div className="craft-settings__group">
        <label className="craft-settings__label">Gap Size: {settings.gapInches.toFixed(3)}"</label>
        <input
          type="range"
          className="craft-settings__slider"
          min={0}
          max={0.5}
          step={0.0625}
          value={settings.gapInches}
          onChange={e => onChange({ gapInches: parseFloat(e.target.value) })}
        />
        <div className="craft-settings__slider-labels">
          <span>0"</span>
          <span>0.5"</span>
        </div>
      </div>

      {/* Max Downscale */}
      <div className="craft-settings__group">
        <label className="craft-settings__label">
          Max Downscale: {settings.maxDownscalePercent}%
        </label>
        <input
          type="range"
          className="craft-settings__slider"
          min={0}
          max={90}
          step={5}
          value={settings.maxDownscalePercent}
          onChange={e => onChange({ maxDownscalePercent: parseInt(e.target.value, 10) })}
        />
        <div className="craft-settings__slider-labels">
          <span>0%</span>
          <span>90%</span>
        </div>
        <p className="craft-settings__hint">How much images can be scaled down to fit better</p>
      </div>

      {/* Normalize Image Sizes */}
      <div className="craft-settings__group">
        <label className="craft-settings__checkbox">
          <input
            type="checkbox"
            checked={settings.normalizeImageSizes}
            onChange={e => onChange({ normalizeImageSizes: e.target.checked })}
          />
          Normalize Image Sizes
        </label>
        <p className="craft-settings__hint">
          Scale larger images down more to make all images similar sizes
        </p>
      </div>

      {/* Min Image Size */}
      <div className="craft-settings__group">
        <label className="craft-settings__label">
          Min Image Size: {settings.minImageSizeInches}"
        </label>
        <input
          type="range"
          className="craft-settings__slider"
          min={0.25}
          max={3}
          step={0.25}
          value={settings.minImageSizeInches}
          onChange={e => onChange({ minImageSizeInches: parseFloat(e.target.value) })}
        />
        <div className="craft-settings__slider-labels">
          <span>0.25"</span>
          <span>3"</span>
        </div>
      </div>

      {/* Cropping Toggle */}
      <div className="craft-settings__group">
        <label className="craft-settings__checkbox">
          <input
            type="checkbox"
            checked={settings.allowCropping}
            onChange={e => onChange({ allowCropping: e.target.checked })}
          />
          Allow Cropping
        </label>
        <p className="craft-settings__hint">Crop images to better fit available spaces</p>
      </div>

      {/* Cropping Options (shown when cropping enabled) */}
      {settings.allowCropping && (
        <>
          <div className="craft-settings__group craft-settings__group--nested">
            <label className="craft-settings__label">Max Crop: {settings.maxCropPercent}%</label>
            <input
              type="range"
              className="craft-settings__slider"
              min={5}
              max={30}
              step={5}
              value={settings.maxCropPercent}
              onChange={e => onChange({ maxCropPercent: parseInt(e.target.value, 10) })}
            />
            <div className="craft-settings__slider-labels">
              <span>5%</span>
              <span>30%</span>
            </div>
          </div>

          <div className="craft-settings__group craft-settings__group--nested">
            <label className="craft-settings__label">Crop Anchor</label>
            <CropAnchorGrid
              value={settings.cropAnchor}
              onChange={anchor => onChange({ cropAnchor: anchor })}
            />
          </div>
        </>
      )}
    </SettingsPanel>
  )
}

interface CropAnchorGridProps {
  value: CropAnchor
  onChange: (anchor: CropAnchor) => void
}

function CropAnchorGrid({ value, onChange }: CropAnchorGridProps) {
  const positions: CropAnchor[][] = [
    ['top-left', 'top', 'top-right'],
    ['left', 'center', 'right'],
    ['bottom-left', 'bottom', 'bottom-right']
  ]

  return (
    <div className="craft-crop-anchor-grid">
      {positions.map((row, rowIdx) => (
        <div key={rowIdx} className="craft-crop-anchor-grid__row">
          {row.map(anchor => (
            <button
              key={anchor}
              type="button"
              className={`craft-crop-anchor-grid__button ${
                value === anchor ? 'craft-crop-anchor-grid__button--active' : ''
              }`}
              onClick={() => onChange(anchor)}
              title={CROP_ANCHOR_LABELS[anchor]}
            >
              <span className="craft-crop-anchor-grid__dot" />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export default CollageSettings

/**
 * TilingSettings Component
 * Settings panel for Simple Tiling and Duplex modes
 */

import React from 'react'
import type { PaperSizeKey, TileSizeKey, PositionOption, LayoutInfo } from '../../domain/types'
import { PAPER_SIZES, TILE_SIZES, POSITION_OPTIONS } from '../../domain/constants'
import { formatLayoutInfo } from '../../domain/processing'
import { SettingsPanel } from '../shared/SettingsPanel'

interface TilingSettingsProps {
  paperSize: PaperSizeKey
  tileSize: TileSizeKey
  dpi: number
  position: PositionOption
  layoutInfo: LayoutInfo | null
  disablePosition?: boolean // For duplex mode
  onPaperSizeChange: (size: PaperSizeKey) => void
  onTileSizeChange: (size: TileSizeKey) => void
  onDpiChange: (dpi: number) => void
  onPositionChange: (position: PositionOption) => void
}

export function TilingSettings({
  paperSize,
  tileSize,
  dpi,
  position,
  layoutInfo,
  disablePosition = false,
  onPaperSizeChange,
  onTileSizeChange,
  onDpiChange,
  onPositionChange
}: TilingSettingsProps) {
  const handleDpiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value > 0 && value <= 1200) {
      onDpiChange(value)
    }
  }

  return (
    <SettingsPanel>
      <div className="craft-settings__group">
        <label className="craft-settings__label" htmlFor="paper-size">
          Output Paper
        </label>
        <select
          id="paper-size"
          className="craft-settings__select"
          value={paperSize}
          onChange={e => onPaperSizeChange(e.target.value as PaperSizeKey)}
        >
          {Object.keys(PAPER_SIZES).map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="craft-settings__group">
        <label className="craft-settings__label" htmlFor="tile-size">
          Card Size
        </label>
        <select
          id="tile-size"
          className="craft-settings__select"
          value={tileSize}
          onChange={e => onTileSizeChange(e.target.value as TileSizeKey)}
        >
          {Object.keys(TILE_SIZES).map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="craft-settings__group">
        <label className="craft-settings__label" htmlFor="dpi">
          DPI
        </label>
        <input
          id="dpi"
          type="number"
          className="craft-settings__input"
          value={dpi}
          onChange={handleDpiChange}
          min={72}
          max={1200}
          step={1}
        />
      </div>

      <div className="craft-settings__group">
        <label className="craft-settings__label" htmlFor="position">
          Position
        </label>
        <select
          id="position"
          className="craft-settings__select"
          value={position}
          onChange={e => onPositionChange(e.target.value as PositionOption)}
          disabled={disablePosition}
        >
          {POSITION_OPTIONS.map(pos => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        {disablePosition && (
          <span className="craft-settings__hint">
            Position is locked to &quot;All&quot; in Duplex mode
          </span>
        )}
      </div>

      {layoutInfo && (
        <div className="craft-settings__layout-info">
          <div className="craft-settings__layout-label">Layout</div>
          <div className="craft-settings__layout-value">{formatLayoutInfo(layoutInfo)}</div>
        </div>
      )}

      {!layoutInfo && (
        <div className="craft-settings__layout-error">
          Card is too large for selected paper size
        </div>
      )}
    </SettingsPanel>
  )
}

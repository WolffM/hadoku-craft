/**
 * StickerSettings Component
 *
 * Controls for the sticker pipeline (Python sidecar). Settings map 1:1 to
 * StickerMaker/main.py argparse:
 *   - copies → --copies
 *   - size   → --size (1-4)
 *   - customOffsetInches → --offset
 *   - testMode → --test
 */

import type {
  StickerImage,
  StickerSettings as StickerSettingsType,
  StickerOffsetSize
} from '../../domain/types'
import { STICKER_OFFSET_SIZES } from '../../domain/constants'
import { ImagePool } from '../shared/ImagePool'
import { SettingsPanel, SettingsSection, SettingsInfo } from '../shared/SettingsPanel'

interface StickerSettingsProps {
  images: StickerImage[]
  settings: StickerSettingsType
  onAddImages: (images: StickerImage[]) => void
  onRemoveImage: (id: string) => void
  onClearImages: () => void
  onSettingsChange: (settings: Partial<StickerSettingsType>) => void
}

export function StickerSettings({
  images,
  settings,
  onAddImages,
  onRemoveImage,
  onClearImages,
  onSettingsChange
}: StickerSettingsProps) {
  const handleSizeChange = (size: StickerOffsetSize) => {
    onSettingsChange({ size, customOffsetInches: null })
  }

  return (
    <SettingsPanel className="craft-sticker-settings">
      <SettingsSection
        title="Sticker Images"
        description='Raw images (backgrounds removed by the pipeline) or pre-cleaned PNGs with transparent backgrounds. Pipeline adds 0.2" of padding, draws a cutline, and tiles onto an 8.5"×11" sheet at 300 DPI.'
      >
        <ImagePool<StickerImage>
          title="Sticker Images"
          images={images}
          onAdd={onAddImages}
          onRemove={onRemoveImage}
          onClear={onClearImages}
        />
      </SettingsSection>

      <SettingsSection title="Pipeline Settings">
        <div className="craft-sticker-settings__group">
          <label className="craft-sticker-settings__label" htmlFor="sticker-copies">
            Copies per image
          </label>
          <input
            id="sticker-copies"
            type="number"
            min={1}
            max={50}
            value={settings.copies}
            onChange={e =>
              onSettingsChange({ copies: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
            className="craft-sticker-settings__input"
          />
        </div>

        <div className="craft-sticker-settings__group">
          <span className="craft-sticker-settings__label">Cutline Offset</span>
          <div className="craft-sticker-settings__radio-group">
            {([1, 2, 3, 4] as StickerOffsetSize[]).map(size => (
              <label key={size} className="craft-sticker-settings__radio">
                <input
                  type="radio"
                  name="sticker-size"
                  checked={settings.customOffsetInches === null && settings.size === size}
                  onChange={() => handleSizeChange(size)}
                />
                <span>
                  {size} ({STICKER_OFFSET_SIZES[size]}")
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="craft-sticker-settings__group">
          <label className="craft-sticker-settings__label" htmlFor="sticker-custom-offset">
            Custom offset (inches, overrides preset)
          </label>
          <input
            id="sticker-custom-offset"
            type="number"
            min={0.01}
            max={0.5}
            step={0.01}
            value={settings.customOffsetInches ?? ''}
            onChange={e => {
              const v = e.target.value.trim()
              onSettingsChange({ customOffsetInches: v === '' ? null : parseFloat(v) })
            }}
            placeholder="(unused)"
            className="craft-sticker-settings__input"
          />
        </div>

        <label className="craft-sticker-settings__checkbox">
          <input
            type="checkbox"
            checked={settings.testMode}
            onChange={e => onSettingsChange({ testMode: e.target.checked })}
          />
          <span>Test mode (generate cutline-size sample page)</span>
        </label>

        <SettingsInfo>
          <p>
            <strong>Requires local server + Python venv:</strong> The bg-removal pipeline runs via a
            Python subprocess on the local machine. Make sure <code>pnpm local:start</code> is
            running and the per-repo venv is set up:
          </p>
          <p>
            <code>cd server && python -m venv .venv && .venv/Scripts/pip install -e .</code>
          </p>
        </SettingsInfo>
      </SettingsSection>
    </SettingsPanel>
  )
}

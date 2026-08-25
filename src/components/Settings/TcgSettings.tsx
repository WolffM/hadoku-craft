/**
 * TcgSettings — settings panel for TCG proxy mode.
 *
 * Game-agnostic chrome (mode tabs, textarea, custom-image pool) with the
 * CardSource-specific bits (placeholder example, input help, cards/sheet
 * math) read from the active source. A Game dropdown switches sources.
 */

import { useState } from 'react'
import { logger } from '@wolffm/logger/client'
import type { TcgGame, TcgInputMode, TcgCustomImage, RiftboundDeck } from '../../domain/types'
import { ImagePool } from '../shared/ImagePool'
import { SettingsPanel, SettingsSection, SettingsInfo } from '../shared/SettingsPanel'
import { SOURCES, SOURCE_ORDER, getSource, buildRiftboundDeck } from '../../domain/processing/tcg'

interface TcgSettingsProps {
  tcgGame: TcgGame
  tcgInputMode: TcgInputMode
  tcgInput: string
  tcgCustomImages: TcgCustomImage[]
  tcgCutlines: boolean
  onGameChange: (game: TcgGame) => void
  onInputModeChange: (mode: TcgInputMode) => void
  onInputChange: (input: string) => void
  onCutlinesChange: (on: boolean) => void
  onAddCustomImages: (images: TcgCustomImage[]) => void
  onRemoveCustomImage: (id: string) => void
  onClearCustomImages: () => void
  /** Optional — only wired when the active source supports a per-slot editor. */
  onBuildRiftboundDeck?: (deck: RiftboundDeck) => void
}

export function TcgSettings({
  tcgGame,
  tcgInputMode,
  tcgInput,
  tcgCustomImages,
  tcgCutlines,
  onGameChange,
  onInputModeChange,
  onInputChange,
  onCutlinesChange,
  onAddCustomImages,
  onRemoveCustomImage,
  onClearCustomImages,
  onBuildRiftboundDeck
}: TcgSettingsProps) {
  const source = getSource(tcgGame)
  const cardsPerSheet = source.cardsPerRow * source.cardsPerCol

  const [editorBuilding, setEditorBuilding] = useState(false)
  const [editorProgress, setEditorProgress] = useState<{ done: number; total: number } | null>(null)
  const [editorMessage, setEditorMessage] = useState<string | null>(null)

  const showEditorButton =
    tcgGame === 'riftbound' &&
    tcgInputMode === 'list' &&
    tcgInput.trim().length > 0 &&
    !!onBuildRiftboundDeck

  const handleBuildEditor = async () => {
    if (!onBuildRiftboundDeck) return
    setEditorMessage(null)
    setEditorBuilding(true)
    setEditorProgress({ done: 0, total: 0 })
    try {
      const { deck, missing } = await buildRiftboundDeck(tcgInput, (done, total) => {
        setEditorProgress({ done, total })
      })
      if (deck.slots.length === 0) {
        setEditorMessage('No cards resolved from the deck list.')
        logger.warn('[TcgSettings] Empty deck after build', { missing })
        return
      }
      if (missing.length > 0) {
        setEditorMessage(
          `${missing.length} line${missing.length === 1 ? '' : 's'} not found in the card index — skipped.`
        )
        logger.warn('[TcgSettings] Some lines missing from index', { missing })
      }
      onBuildRiftboundDeck(deck)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Build failed'
      setEditorMessage(message)
      logger.error('[TcgSettings] Deck build failed', { error: message })
    } finally {
      setEditorBuilding(false)
      setEditorProgress(null)
    }
  }

  const cardCount = tcgInput
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#')).length

  const description =
    tcgInputMode === 'list' ? source.inputHelp : 'Pre-rendered card images placed on sheets.'

  const sheetCountListMode = Math.max(1, Math.ceil(cardCount / cardsPerSheet))
  const sheetCountCustomMode = Math.max(1, Math.ceil(tcgCustomImages.length / cardsPerSheet))

  return (
    <SettingsPanel className="craft-tcg-settings">
      <SettingsSection title="TCG Proxy Source" description={description}>
        <div className="craft-tcg-settings__group">
          <label className="craft-tcg-settings__label" htmlFor="tcg-game">
            Game
          </label>
          <select
            id="tcg-game"
            className="craft-tcg-settings__select"
            value={tcgGame}
            onChange={e => onGameChange(e.target.value as TcgGame)}
          >
            {SOURCE_ORDER.map(id => (
              <option key={id} value={id}>
                {SOURCES[id].label}
              </option>
            ))}
          </select>
        </div>

        <div className="craft-tcg-settings__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tcgInputMode === 'list'}
            className={`craft-tcg-settings__tab ${
              tcgInputMode === 'list' ? 'craft-tcg-settings__tab--active' : ''
            }`}
            onClick={() => onInputModeChange('list')}
          >
            Card List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tcgInputMode === 'custom'}
            className={`craft-tcg-settings__tab ${
              tcgInputMode === 'custom' ? 'craft-tcg-settings__tab--active' : ''
            }`}
            onClick={() => onInputModeChange('custom')}
          >
            Custom Images
          </button>
        </div>

        {tcgInputMode === 'list' ? (
          <>
            <textarea
              className="craft-tcg-settings__textarea"
              value={tcgInput}
              onChange={e => onInputChange(e.target.value)}
              placeholder={source.placeholderExample}
              rows={10}
              spellCheck={false}
            />
            <div className="craft-tcg-settings__hint">
              {cardCount} card{cardCount === 1 ? '' : 's'} · {sheetCountListMode} sheet
              {sheetCountListMode === 1 ? '' : 's'}
            </div>

            {showEditorButton && (
              <div className="craft-tcg-settings__editor-launch">
                <button
                  type="button"
                  className="craft-riftbound-editor__button craft-riftbound-editor__button--primary"
                  onClick={() => {
                    void handleBuildEditor()
                  }}
                  disabled={editorBuilding}
                >
                  {editorBuilding
                    ? editorProgress && editorProgress.total > 0
                      ? `Loading art ${editorProgress.done}/${editorProgress.total}…`
                      : 'Parsing deck…'
                    : 'Open Deck Editor'}
                </button>
                {editorMessage && (
                  <p className="craft-tcg-settings__editor-message">{editorMessage}</p>
                )}
                <p className="craft-tcg-settings__editor-hint">
                  Pre-fetches every alt-art variant so you can pick per-card art before saving.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <ImagePool<TcgCustomImage>
              title="Card Images"
              images={tcgCustomImages}
              onAdd={onAddCustomImages}
              onRemove={onRemoveCustomImage}
              onClear={onClearCustomImages}
            />
            {tcgCustomImages.length > 0 && (
              <div className="craft-tcg-settings__hint">
                {sheetCountCustomMode} sheet{sheetCountCustomMode === 1 ? '' : 's'}
              </div>
            )}
          </>
        )}

        <label className="craft-settings__checkbox">
          <input
            type="checkbox"
            checked={tcgCutlines}
            onChange={e => onCutlinesChange(e.target.checked)}
          />
          <span>Add cut lines (crop marks)</span>
        </label>

        <SettingsInfo>
          <p>
            <strong>Output:</strong> 8.5" × 11" sheets at 300 DPI, {source.cardsPerRow}×
            {source.cardsPerCol} grid of {source.cardWidthInches}" × {source.cardHeightInches}"
            cards. Cards with back faces generate a mirrored back sheet for duplex printing.
          </p>
        </SettingsInfo>
      </SettingsSection>
    </SettingsPanel>
  )
}

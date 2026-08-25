/**
 * RiftboundDeckEditor
 *
 * Per-slot art picker for a parsed Riftbound deck. Renders the deck as
 * 3×3 grid pages (matching the eventual print layout), with a dropdown
 * above every slot to swap among the pre-fetched alt-art variants.
 *
 * Save: composites the deck into print sheets using the currently-selected
 * variant for every slot, pastes the standard Riftbound cardback into every
 * occupied slot on the back sheet, and downloads each sheet as a PNG.
 *
 * All variant images are pre-fetched as data URLs at deck-build time, so
 * variant switching is instantaneous (no extra network round-trip).
 */

import { useState } from 'react'
import { logger } from '@wolffm/logger/client'
import type { RiftboundDeck } from '../../domain/types'
import { createTcgSheets, getSource, type FetchedCard } from '../../domain/processing/tcg'
import { loadImage } from '../../domain/processing/canvasUtils'
import { downloadCanvasAsPng } from '../../api/craftApi'
import cardbackUrl from '../../assets/cardback.webp?inline'

interface Props {
  deck: RiftboundDeck
  cutlines: boolean
  onSlotVariantChange: (slotIndex: number, variantId: string) => void
  onClose: () => void
}

const CARDS_PER_PAGE = 9 // 3×3 — matches the print sheet layout

export function RiftboundDeckEditor({ deck, cutlines, onSlotVariantChange, onClose }: Props) {
  const [pageIndex, setPageIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(deck.slots.length / CARDS_PER_PAGE))
  const pageStart = pageIndex * CARDS_PER_PAGE
  const pageSlots = deck.slots.slice(pageStart, pageStart + CARDS_PER_PAGE)

  const handleSave = async () => {
    setSaveError(null)
    setIsSaving(true)
    setSaveProgress({ done: 0, total: deck.slots.length })
    try {
      const source = getSource('riftbound')

      // Load the cardback once — it's reused for every slot's back.
      const cardback = await loadImage(cardbackUrl)

      // Resolve every slot's selected variant to an HTMLImageElement via the
      // pre-fetched data-URL cache. Missing entries (variant 404'd at build
      // time) fall back to a transparent 1×1, which gets visibly skipped.
      const cards: FetchedCard[] = []
      let done = 0
      for (const slot of deck.slots) {
        const dataUrl = deck.variantImages[slot.selectedId]
        if (!dataUrl) {
          logger.warn('[RiftboundDeckEditor] No cached image for selected variant', {
            id: slot.selectedId
          })
          done++
          setSaveProgress({ done, total: deck.slots.length })
          continue
        }
        const front = await loadImage(dataUrl)
        cards.push({ front, back: cardback })
        done++
        setSaveProgress({ done, total: deck.slots.length })
      }

      if (cards.length === 0) {
        throw new Error('No card images resolved — variant cache is empty.')
      }

      const sheets = await createTcgSheets({
        source,
        cards,
        cutlines,
        onProgress: (current, total) => setSaveProgress({ done: current, total })
      })

      const stamp = new Date().toISOString().slice(0, 10)
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i]
        const n = i + 1
        downloadCanvasAsPng(sheet.front, `riftbound_deck_${stamp}_sheet${n}_front.png`)
        if (sheet.back) {
          downloadCanvasAsPng(sheet.back, `riftbound_deck_${stamp}_sheet${n}_back.png`)
        }
      }

      logger.info('[RiftboundDeckEditor] Deck saved', {
        sheets: sheets.length,
        cards: cards.length
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setSaveError(message)
      logger.error('[RiftboundDeckEditor] Save failed', { error: message })
    } finally {
      setIsSaving(false)
      setSaveProgress(null)
    }
  }

  if (deck.slots.length === 0) {
    return (
      <div className="craft-riftbound-editor craft-riftbound-editor--empty">
        <p>No cards resolved from the deck list.</p>
        <button type="button" className="craft-riftbound-editor__button" onClick={onClose}>
          Back to deck list
        </button>
      </div>
    )
  }

  return (
    <div className="craft-riftbound-editor">
      <header className="craft-riftbound-editor__header">
        <div>
          <h3 className="craft-riftbound-editor__title">Riftbound Deck Editor</h3>
          <p className="craft-riftbound-editor__subtitle">
            {deck.slots.length} card{deck.slots.length === 1 ? '' : 's'} · Sheet {pageIndex + 1} of{' '}
            {totalPages}
          </p>
        </div>
        <div className="craft-riftbound-editor__header-actions">
          <button
            type="button"
            className="craft-riftbound-editor__button craft-riftbound-editor__button--ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            Close
          </button>
          <button
            type="button"
            className="craft-riftbound-editor__button craft-riftbound-editor__button--primary"
            onClick={() => {
              void handleSave()
            }}
            disabled={isSaving}
          >
            {isSaving
              ? saveProgress
                ? `Saving ${saveProgress.done}/${saveProgress.total}…`
                : 'Saving…'
              : 'Save sheets'}
          </button>
        </div>
      </header>

      {saveError && <div className="craft-riftbound-editor__error">{saveError}</div>}

      <div className="craft-riftbound-editor__grid">
        {pageSlots.map((slot, localIdx) => {
          const slotIndex = pageStart + localIdx
          const dataUrl = deck.variantImages[slot.selectedId]
          const hasVariants = slot.variants.length > 1
          return (
            <div key={slotIndex} className="craft-riftbound-editor__slot">
              <select
                className="craft-riftbound-editor__select"
                value={slot.selectedId}
                onChange={e => onSlotVariantChange(slotIndex, e.target.value)}
                disabled={!hasVariants || isSaving}
                title={hasVariants ? `${slot.variants.length} variants` : 'Only one printing'}
              >
                {slot.variants.map(vid => (
                  <option key={vid} value={vid}>
                    {vid}
                    {vid === slot.variants[0] ? ' (original)' : ''}
                  </option>
                ))}
              </select>
              <div className="craft-riftbound-editor__thumb">
                {dataUrl ? (
                  <img src={dataUrl} alt={slot.name || slot.selectedId} loading="lazy" />
                ) : (
                  <div className="craft-riftbound-editor__thumb-missing">
                    {slot.selectedId}
                    <br />
                    (not found)
                  </div>
                )}
              </div>
              <div className="craft-riftbound-editor__caption" title={slot.raw}>
                {slot.name || slot.selectedId}
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <nav className="craft-riftbound-editor__pager">
          <button
            type="button"
            className="craft-riftbound-editor__button"
            onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0 || isSaving}
          >
            ‹ Previous sheet
          </button>
          <span className="craft-riftbound-editor__pager-label">
            Sheet {pageIndex + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="craft-riftbound-editor__button"
            onClick={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={pageIndex === totalPages - 1 || isSaving}
          >
            Next sheet ›
          </button>
        </nav>
      )}
    </div>
  )
}

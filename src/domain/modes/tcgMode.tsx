/**
 * TCG Proxies mode — game-agnostic card sheet compositor.
 *
 * Delegates to a CardSource plugin (MTG via Scryfall, Riftbound via
 * piltoverarchive CDN, plus any future TCG) for parsing + image fetching.
 * The compositor itself is shared (createTcgSheets), parameterised by the
 * source's card dimensions and grid.
 */

import { logger } from '@wolffm/logger/client'
import type { ModeModule } from './types'
import { TcgSettings } from '../../components/Settings/TcgSettings'
import {
  createTcgSheets,
  createTcgSheetsFromImages,
  parseDeckList,
  expandByCount,
  getSource,
  type FetchedCard,
  type TcgSheet
} from '../processing/tcg'
import { loadImage } from '../processing/canvasUtils'

export const tcgMode: ModeModule = {
  id: 'tcg',
  label: 'TCG Proxies',
  processingTitle: 'Building TCG Sheets...',

  canProcess: state => {
    if (state.tcgInputMode === 'list') return state.tcgInput.trim().length > 0
    return state.tcgCustomImages.length > 0
  },

  // Both input branches are listed regardless of the active tcgInputMode:
  // switching modes changes the output, so the mode itself is a dependency,
  // and the inactive branch's value is cheap to compare.
  processDeps: state => [
    state.tcgGame,
    state.tcgInputMode,
    state.tcgInput,
    state.tcgCustomImages,
    state.tcgCutlines
  ],

  renderSettings: ({ state, actions }) => (
    <TcgSettings
      tcgGame={state.tcgGame}
      tcgInputMode={state.tcgInputMode}
      tcgInput={state.tcgInput}
      tcgCustomImages={state.tcgCustomImages}
      tcgCutlines={state.tcgCutlines}
      onGameChange={actions.setTcgGame}
      onInputModeChange={actions.setTcgInputMode}
      onInputChange={actions.setTcgInput}
      onCutlinesChange={actions.setTcgCutlines}
      onAddCustomImages={actions.addTcgCustomImages}
      onRemoveCustomImage={actions.removeTcgCustomImage}
      onClearCustomImages={actions.clearTcgCustomImages}
      onBuildRiftboundDeck={actions.setRiftboundDeck}
    />
  ),

  process: async ({ state, reportProgress }) => {
    const source = getSource(state.tcgGame)
    let sheets: TcgSheet[]

    if (state.tcgInputMode === 'list') {
      // Parse + expand by count (e.g. "3 OGN-007" → 3 entries).
      const rawEntries = parseDeckList(state.tcgInput, source)
      if (rawEntries.length === 0) {
        throw new Error('No valid card entries found')
      }
      const entries = expandByCount(rawEntries)

      reportProgress({
        step: 0,
        total: entries.length,
        message: `Fetching ${entries.length} cards from ${source.label}...`
      })

      const fetched: FetchedCard[] = []
      const missing: string[] = []
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        reportProgress({
          step: i,
          total: entries.length,
          message: `Fetching: ${entry.raw}`
        })
        const card = await source.fetchCard(entry)
        if (card) fetched.push(card)
        else missing.push(entry.raw)
      }

      if (fetched.length === 0) {
        throw new Error(`No cards could be fetched. Failed: ${missing.join(', ')}`)
      }

      reportProgress({ step: 0, total: fetched.length, message: 'Building sheets...' })
      sheets = await createTcgSheets({
        source,
        cards: fetched,
        cutlines: state.tcgCutlines,
        onProgress: (current, total) =>
          reportProgress({
            step: current,
            total,
            message: `Composing card ${current}/${total}`
          })
      })

      if (missing.length > 0) {
        logger.warn('[tcgMode] Some cards failed to fetch', {
          source: source.id,
          missing
        })
      }
    } else {
      reportProgress({
        step: 0,
        total: state.tcgCustomImages.length,
        message: 'Loading images...'
      })

      const images = await Promise.all(state.tcgCustomImages.map(c => loadImage(c.dataUrl)))
      sheets = await createTcgSheetsFromImages(
        source,
        images,
        (current, total) =>
          reportProgress({
            step: current,
            total,
            message: `Composing card ${current}/${total}`
          }),
        state.tcgCutlines
      )
    }

    reportProgress(null)
    if (sheets.length === 0) {
      throw new Error('No sheets generated')
    }

    const first = sheets[0]
    return {
      frontCanvas: first.front,
      backCanvas: first.back,
      sheets,
      layoutInfo: null,
      filename: `${source.id}_proxies_${new Date().toISOString().slice(0, 10)}`
    }
  }
}

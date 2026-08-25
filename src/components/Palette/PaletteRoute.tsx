/**
 * The palette route: extract and manage a colour palette from an image.
 *
 * Absorbed from the standalone color_palette_picker, which was a vanilla
 * page loading ColorThief off a CDN. The extraction algorithm now lives in
 * `domain/palette/quantize.ts`, notifications use the shared Toaster instead
 * of a hand-rolled stacking system, and the whole thing is a route of Craft.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Toaster, useToast } from '@wolffm/task-ui-components'
import { logger } from '@wolffm/logger/client'
import { PaletteCanvas } from './PaletteCanvas'
import { PaletteSwatches } from './PaletteSwatches'
import { PaletteToolbar } from './PaletteToolbar'
import { usePalette } from '../../hooks/usePalette'
import { loadPaletteImage, type PaletteImage } from '../../hooks/loadPaletteImage'
import { rgbToHex, type Hex } from '../../domain/palette/color'
import { averageAt, cropRegion, type Region } from '../../domain/palette/sampling'
import {
  prefillStandard,
  prefillAdvanced,
  isUsablePrefill,
  type PrefillKind
} from '../../domain/palette/prefill'
import { paletteToText, renderPaletteSheet } from '../../domain/palette/exportPalette'
import { downloadCanvasAsPng } from '../../api/craftApi'
import { MAX_COLORS } from '../../domain/palette/constants'

/** Don't steal keyboard shortcuts from a field someone is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function PaletteRoute() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<PaletteImage | null>(null)
  const [zoom, setZoom] = useState(1)
  const [cropKind, setCropKind] = useState<PrefillKind | null>(null)

  const palette = usePalette()
  const { toasts, showToast, dismissToast } = useToast()

  const requestUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return

      loadPaletteImage(file)
        .then(loaded => {
          setImage(loaded)
          setCropKind(null)
          logger.info('[PaletteRoute] Image loaded', {
            name: loaded.name,
            width: loaded.pixels.width,
            height: loaded.pixels.height
          })
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to load image'
          showToast(message, 'error')
          logger.error('[PaletteRoute] Image load failed', { error: message })
        })
    },
    [showToast]
  )

  /** Sample the 3x3 block under a click and append the result. */
  const handlePick = useCallback(
    (point: { x: number; y: number }) => {
      if (!image) return
      if (palette.isFull) {
        showToast(`Palette is full (${MAX_COLORS} colors)`, 'warning')
        return
      }

      const rgb = averageAt(image.pixels, point.x, point.y)
      if (!rgb) return // Clicked the empty area beside the image.

      palette.addColor(rgbToHex(rgb.r, rgb.g, rgb.b))
    },
    [image, palette, showToast]
  )

  /** Replace the palette from a quantized region (or the whole image). */
  const runPrefill = useCallback(
    (kind: PrefillKind, region?: Region) => {
      if (!image) return

      const source = region ? cropRegion(image.pixels, region) : image.pixels
      if (!source) {
        showToast('That selection is outside the image', 'warning')
        return
      }

      const colors = kind === 'advanced' ? prefillAdvanced(source) : prefillStandard(source)

      // An empty result would silently wipe a hand-picked palette, which is
      // the one outcome worse than doing nothing.
      if (!isUsablePrefill(colors)) {
        showToast('No colors could be extracted from that area', 'warning')
        return
      }

      palette.setColors(colors, kind)
      showToast(`Extracted ${colors.length} ${colors.length === 1 ? 'color' : 'colors'}`, 'success')
    },
    [image, palette, showToast]
  )

  const handleCropComplete = useCallback(
    (region: Region) => {
      const kind = cropKind
      setCropKind(null)
      if (kind) runPrefill(kind, region)
    },
    [cropKind, runPrefill]
  )

  const handleStartCrop = useCallback(
    (kind: PrefillKind) => {
      setCropKind(kind)
      showToast('Drag a rectangle to select the area to extract from', 'info')
    },
    [showToast]
  )

  const handleCopy = useCallback(() => {
    if (palette.colors.length === 0) return
    navigator.clipboard
      .writeText(paletteToText(palette.colors))
      .then(() => {
        showToast('Palette copied to clipboard', 'success')
      })
      .catch(() => {
        showToast('Could not write to the clipboard', 'error')
      })
  }, [palette.colors, showToast])

  const handleCopyColor = useCallback(
    (hex: Hex) => {
      navigator.clipboard
        .writeText(hex)
        .then(() => {
          showToast(`Copied ${hex.toUpperCase()}`, 'success')
        })
        .catch(() => {
          showToast('Could not write to the clipboard', 'error')
        })
    },
    [showToast]
  )

  const handleExportImage = useCallback(() => {
    if (palette.colors.length === 0) return
    try {
      downloadCanvasAsPng(renderPaletteSheet(palette.colors), 'color-palette.png')
      showToast('Palette image downloaded', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      showToast(message, 'error')
      logger.error('[PaletteRoute] Palette export failed', { error: message })
    }
  }, [palette.colors, showToast])

  const handleUndo = useCallback(() => {
    if (!palette.canUndo) return
    palette.undo()
    showToast('Undone', 'info')
  }, [palette, showToast])

  // Keyboard shortcuts, carried over from the standalone tool. Bound to the
  // window only while this route is mounted, so the print route and the host
  // page keep their own Ctrl+S and Ctrl+D.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || isTypingTarget(e.target)) return

      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault()
          handleUndo()
          break
        case 'c':
          // Never pre-empt a real text copy — if something is selected, the
          // browser's own Ctrl+C is what the user meant.
          if (window.getSelection()?.toString()) return
          if (palette.colors.length === 0) return
          e.preventDefault()
          handleCopy()
          break
        case 'e':
          if (palette.colors.length === 0) return
          e.preventDefault()
          handleExportImage()
          break
        case 's':
          if (!image || cropKind) return
          e.preventDefault()
          handleStartCrop('standard')
          break
        case 'd':
          if (!image || cropKind) return
          e.preventDefault()
          handleStartCrop('advanced')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    handleUndo,
    handleCopy,
    handleExportImage,
    handleStartCrop,
    palette.colors.length,
    image,
    cropKind
  ])

  return (
    <div className="craft-palette">
      <PaletteToolbar
        hasImage={image !== null}
        hasColors={palette.colors.length > 0}
        canUndo={palette.canUndo}
        isCropping={cropKind !== null}
        zoom={zoom}
        onUpload={requestUpload}
        onPrefill={runPrefill}
        onStartCrop={handleStartCrop}
        onCancelCrop={() => {
          setCropKind(null)
        }}
        onCopy={handleCopy}
        onExportImage={handleExportImage}
        onUndo={handleUndo}
        onClear={palette.clear}
      />

      <div className="craft-palette__layout">
        <PaletteCanvas
          image={image?.element ?? null}
          isCropping={cropKind !== null}
          onPick={handlePick}
          onCrop={handleCropComplete}
          onCropTooSmall={() => {
            setCropKind(null)
            showToast('That selection is too small — try again', 'warning')
          }}
          onZoomChange={setZoom}
          onRequestUpload={requestUpload}
        />

        <PaletteSwatches
          colors={palette.colors}
          onCopyColor={handleCopyColor}
          onRemove={palette.removeAt}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        className="craft-palette__file-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Bottom-right, not top-right: the AppHeader keeps its theme picker and
          settings buttons in the top-right corner, and a toast landing there
          covers them for the two seconds it is up. */}
      <Toaster toasts={toasts} onDismiss={dismissToast} position="bottom-right" />
    </div>
  )
}

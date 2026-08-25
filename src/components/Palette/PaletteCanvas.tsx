/**
 * The image pane: pan, zoom, click-to-pick, and crop selection.
 *
 * Two coordinate spaces are in play. Canvas space is CSS pixels within the
 * <canvas>; image space is pixels of the source image. `pan` is stored in
 * image space so a zoom change does not have to rescale it, which is why the
 * draw transform is `translate(pan * zoom)` then `scale(zoom)`.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import {
  DRAG_THRESHOLD,
  MIN_CROP_SIZE,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP
} from '../../domain/palette/constants'
import type { Region } from '../../domain/palette/sampling'

interface Point {
  x: number
  y: number
}

interface CropDrag {
  start: Point
  current: Point
}

export interface PaletteCanvasProps {
  image: HTMLImageElement | null
  /** When set, the next drag draws a crop rectangle instead of panning. */
  isCropping: boolean
  /** Called with a point in image space when the user clicks without dragging. */
  onPick: (point: Point) => void
  /** Called with a region in image space once a crop drag completes. */
  onCrop: (region: Region) => void
  /** Called when a crop drag ends without covering enough area. */
  onCropTooSmall: () => void
  onZoomChange: (zoom: number) => void
  onRequestUpload: () => void
}

export function PaletteCanvas({
  image,
  isCropping,
  onPick,
  onCrop,
  onCropTooSmall,
  onZoomChange,
  onRequestUpload
}: PaletteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [cropDrag, setCropDrag] = useState<CropDrag | null>(null)

  // Pan bookkeeping lives in refs: it changes on every pointermove and must not
  // re-render the tree, only redraw the canvas.
  const panStateRef = useRef<{ lastX: number; lastY: number; moved: boolean } | null>(null)

  const toImageSpace = useCallback(
    (canvasX: number, canvasY: number): Point => ({
      x: (canvasX - pan.x * zoom) / zoom,
      y: (canvasY - pan.y * zoom) / zoom
    }),
    [pan.x, pan.y, zoom]
  )

  const canvasPoint = useCallback((e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  /** Size the canvas to its pane and frame the image so it fills the view. */
  const fitToPane = useCallback(() => {
    const canvas = canvasRef.current
    const pane = paneRef.current
    if (!canvas || !pane) return

    const width = pane.clientWidth
    const height = pane.clientHeight
    if (width === 0 || height === 0) return

    canvas.width = width
    canvas.height = height

    if (!image) return

    // Fill rather than fit: a letterboxed photo wastes the pane, and panning
    // to the hidden edges is one drag away.
    const nextZoom = Math.max(width / image.naturalWidth, height / image.naturalHeight)
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom))

    setZoom(clamped)
    setPan({
      x: (width / clamped - image.naturalWidth) / 2,
      y: (height / clamped - image.naturalHeight) / 2
    })
    onZoomChange(clamped)
  }, [image, onZoomChange])

  // Re-frame whenever a new image arrives.
  useLayoutEffect(() => {
    fitToPane()
  }, [fitToPane])

  // Keep the canvas backing store in step with the pane. Without this a window
  // resize leaves the canvas at its old size and the image visibly stretches.
  useEffect(() => {
    const pane = paneRef.current
    const canvas = canvasRef.current
    if (!pane || !canvas) return

    const observer = new ResizeObserver(() => {
      const width = pane.clientWidth
      const height = pane.clientHeight
      // Bail when nothing actually changed. Assigning canvas.width clears the
      // canvas and schedules a repaint, so an unconditional write here turns
      // any stray observation into a redraw storm.
      if (width === canvas.width && height === canvas.height) return

      canvas.width = width
      canvas.height = height
      setPan(p => ({ ...p }))
    })
    observer.observe(pane)
    return () => {
      observer.disconnect()
    }
  }, [])

  /** Repaint: image under the current transform, then the crop overlay. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!image) return

    ctx.save()
    ctx.translate(pan.x * zoom, pan.y * zoom)
    ctx.scale(zoom, zoom)
    ctx.drawImage(image, 0, 0)
    ctx.restore()

    if (!cropDrag) return

    const x = Math.min(cropDrag.start.x, cropDrag.current.x)
    const y = Math.min(cropDrag.start.y, cropDrag.current.y)
    const w = Math.abs(cropDrag.current.x - cropDrag.start.x)
    const h = Math.abs(cropDrag.current.y - cropDrag.start.y)

    // Dim everything, then punch the selection back through at full strength.
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.clearRect(x, y, w, h)

    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.translate(pan.x * zoom, pan.y * zoom)
    ctx.scale(zoom, zoom)
    ctx.drawImage(image, 0, 0)
    ctx.restore()

    // Borrow the live theme's accent so the marquee matches the app rather
    // than being a hard-coded blue that clashes in every theme but one.
    const accent = getComputedStyle(canvas).getPropertyValue('--color-primary').trim()
    ctx.strokeStyle = accent || '#ffffff'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(x, y, w, h)
    ctx.restore()
  }, [image, zoom, pan, cropDrag])

  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLCanvasElement>) => {
      if (!image) return
      const factor = e.deltaY > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP
      setZoom(prev => {
        const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev * factor))
        onZoomChange(next)
        return next
      })
    },
    [image, onZoomChange]
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!image || e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const point = canvasPoint(e)

      if (isCropping) {
        setCropDrag({ start: point, current: point })
      } else {
        panStateRef.current = { lastX: e.clientX, lastY: e.clientY, moved: false }
      }
    },
    [image, isCropping, canvasPoint]
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!image) return

      if (cropDrag) {
        setCropDrag({ start: cropDrag.start, current: canvasPoint(e) })
        return
      }

      const panState = panStateRef.current
      if (!panState) return

      const dx = e.clientX - panState.lastX
      const dy = e.clientY - panState.lastY
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        panState.moved = true
      }

      panState.lastX = e.clientX
      panState.lastY = e.clientY
      setPan(prev => ({ x: prev.x + dx / zoom, y: prev.y + dy / zoom }))
    },
    [image, cropDrag, canvasPoint, zoom]
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      if (cropDrag) {
        const a = toImageSpace(cropDrag.start.x, cropDrag.start.y)
        const b = toImageSpace(cropDrag.current.x, cropDrag.current.y)
        const region: Region = {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.abs(b.x - a.x),
          height: Math.abs(b.y - a.y)
        }
        setCropDrag(null)

        if (region.width < MIN_CROP_SIZE || region.height < MIN_CROP_SIZE) {
          onCropTooSmall()
        } else {
          onCrop(region)
        }
        return
      }

      const panState = panStateRef.current
      panStateRef.current = null
      // A press that never travelled is a colour pick, not a pan.
      if (panState && !panState.moved) {
        const point = canvasPoint(e)
        onPick(toImageSpace(point.x, point.y))
      }
    },
    [cropDrag, toImageSpace, canvasPoint, onPick, onCrop, onCropTooSmall]
  )

  const handlePointerCancel = useCallback(() => {
    panStateRef.current = null
    setCropDrag(null)
  }, [])

  return (
    <div className="craft-palette-canvas" ref={paneRef}>
      <canvas
        ref={canvasRef}
        className={`craft-palette-canvas__surface ${
          isCropping ? 'craft-palette-canvas__surface--cropping' : ''
        }`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {!image && (
        <button type="button" className="craft-palette-canvas__empty" onClick={onRequestUpload}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="craft-palette-canvas__empty-title">Upload an image to get started</span>
          <span className="craft-palette-canvas__empty-hint">
            JPG, PNG or WebP — click anywhere to choose one
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * Craft API
 * Backend API calls for ImageMagick processing and TIFF export.
 */

import { logger } from '@wolffm/logger/client'
import type {
  CalibrationRequest,
  CalibrationResponse,
  ExportRequest,
  ExportResponse,
  Variation
} from '../domain/types'

// API base URL - matches edge-router pattern /<service>/api
const API_BASE_URL = '/craft/api'

/**
 * Convert a canvas to base64 PNG data
 */
export function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1]
}

/**
 * Convert a data URL to base64 string
 */
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1]
}

/**
 * Download a base64 file
 */
export function downloadBase64File(base64: string, filename: string, mimeType: string): void {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download a canvas as PNG
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob(blob => {
    if (!blob) {
      logger.error('[craftApi] Failed to create blob from canvas')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

export interface CalibrationProgress {
  step: number
  total: number
  message: string
}

/**
 * Generate a calibration sheet using the backend ImageMagick service.
 * Uses Server-Sent Events for progress updates.
 *
 * @param imageBase64 - Source image as base64
 * @param paperSize - Paper size key (e.g., "Letter", "11x17")
 * @param grid - Grid dimensions [cols, rows]
 * @param dpi - Output DPI
 * @param variations - Array of variations with labels and ImageMagick args
 * @param onProgress - Callback for progress updates
 */
export async function generateCalibrationSheet(
  imageBase64: string,
  paperSize: string,
  grid: [number, number],
  dpi: number,
  variations: Variation[],
  onProgress?: (progress: CalibrationProgress) => void
): Promise<CalibrationResponse> {
  logger.info('[craftApi] Generating calibration sheet', {
    paperSize,
    grid,
    dpi,
    variationCount: variations.length
  })

  const request: CalibrationRequest = {
    image: imageBase64,
    paperSize,
    grid,
    dpi,
    variations
  }

  try {
    const response = await fetch(`${API_BASE_URL}/calibration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
    }

    // Handle SSE response
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let result: CalibrationResponse | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events from buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          // Next data line will be for this event type
          continue
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          try {
            const parsed = JSON.parse(data) as
              | CalibrationProgress
              | CalibrationResponse
              | { success: false; error: string }

            // Check if this is a progress update
            if ('step' in parsed && 'total' in parsed) {
              onProgress?.(parsed)
            }
            // Check if this is an error
            else if ('success' in parsed && !parsed.success) {
              throw new Error(parsed.error || 'Unknown error')
            }
            // Check if this is the final result
            else if ('success' in parsed && parsed.success) {
              result = parsed
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              // JSON parse error, skip
              continue
            }
            throw e
          }
        }
      }
    }

    if (!result) {
      throw new Error('No result received from server')
    }

    logger.info('[craftApi] Calibration sheet generated successfully')
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[craftApi] Failed to generate calibration sheet', { error: message })
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Export an image to TIFF format using the backend service.
 *
 * @param imageBase64 - Source image as base64 PNG
 * @param dpi - DPI to embed in TIFF metadata
 */
export async function exportToTiff(imageBase64: string, dpi: number): Promise<ExportResponse> {
  logger.info('[craftApi] Exporting to TIFF', { dpi })

  const request: ExportRequest = {
    image: imageBase64,
    format: 'tiff',
    dpi
  }

  try {
    const response = await fetch(`${API_BASE_URL}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
    }

    const data = (await response.json()) as ExportResponse

    if (!data.success) {
      throw new Error(data.error || 'Unknown error exporting to TIFF')
    }

    logger.info('[craftApi] TIFF export successful')
    return data
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[craftApi] Failed to export to TIFF', { error: message })
    return {
      success: false,
      error: message
    }
  }
}

export interface StickerApiInput {
  filename: string
  /** Base64 (no data: prefix) */
  data: string
}

export interface StickerApiRequest {
  images: StickerApiInput[]
  copies?: number
  size?: number
  offsetInches?: number
  test?: boolean
}

export interface StickerApiResponse {
  success: boolean
  data?: {
    /** Data URL of the resulting JPEG sheet */
    image: string
    filename: string
    sizeBytes: number
    stdout?: string
    stderr?: string
  }
  error?: string
}

/**
 * Run the StickerMaker pipeline via the local Python sidecar.
 * Requires the local server + Python (rembg, scipy, Pillow) to be available.
 */
export async function processSticker(req: StickerApiRequest): Promise<StickerApiResponse> {
  logger.info('[craftApi] Processing sticker batch', {
    count: req.images.length,
    copies: req.copies,
    size: req.size,
    test: req.test
  })

  try {
    const response = await fetch(`${API_BASE_URL}/sticker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    })

    const data = (await response.json()) as StickerApiResponse
    if (!response.ok) {
      const errMsg = data.error || `HTTP error ${response.status}`
      throw new Error(errMsg)
    }
    if (!data.success) {
      throw new Error(data.error || 'Sticker processing failed')
    }

    logger.info('[craftApi] Sticker processing successful', {
      filename: data.data?.filename,
      sizeBytes: data.data?.sizeBytes
    })
    return data
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[craftApi] Sticker processing failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * Load a data URL into an HTMLCanvasElement for preview.
 */
export async function imageDataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('Failed to load image data URL'))
    img.src = dataUrl
  })
}

/**
 * Check if the backend API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET'
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Convert a TIFF data URL to a canvas for preview.
 * Since browsers can't display TIFF natively, we attempt to load it
 * as an image (works in some browsers), or fall back to a placeholder.
 */
export async function tiffToCanvas(tiffDataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
      }
      resolve(canvas)
    }
    img.onerror = () => {
      // TIFF not supported by browser, create placeholder
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, 800, 600)
        ctx.fillStyle = '#333'
        ctx.font = '24px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('TIFF Preview Not Available', 400, 280)
        ctx.font = '16px sans-serif'
        ctx.fillText('Click Download to save the calibration sheet', 400, 320)
      }
      resolve(canvas)
    }
    img.src = tiffDataUrl
  })
}

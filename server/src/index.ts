/**
 * Craft Local Processing Server
 *
 * Runs on your local machine and receives requests via Cloudflare Tunnel.
 * Processes images using ImageMagick and returns the results.
 *
 * Usage:
 *   pnpm dev    # Start with hot reload
 *   pnpm start  # Start in production mode
 *
 * Requires:
 *   - ImageMagick installed on the system
 *   - Cloudflare Tunnel running (cloudflared)
 */

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import {
  checkImageMagick,
  generateCalibrationSheetWithProgress,
  exportImage
} from './imagemagick.js'
import { processSticker, checkStickerEnvironment, type StickerImageInput } from './sticker.js'

const app = new Hono().basePath('/craft/api')

// CORS middleware
app.use('*', cors())

// Health check
app.get('/health', async c => {
  const [hasImageMagick, stickerEnv] = await Promise.all([
    checkImageMagick(),
    checkStickerEnvironment()
  ])
  const warnings: string[] = []
  if (!hasImageMagick) warnings.push('ImageMagick not found in PATH')
  if (!stickerEnv.python) warnings.push('Python not found — sticker mode disabled')
  else if (!stickerEnv.rembg) warnings.push('Python `rembg` not installed — sticker mode disabled')
  else if (!stickerEnv.scipy) warnings.push('Python `scipy` not installed — sticker mode disabled')

  return c.json({
    success: true,
    data: {
      status: hasImageMagick && stickerEnv.python ? 'healthy' : 'degraded',
      service: 'craft-local',
      timestamp: new Date().toISOString(),
      imagemagick: hasImageMagick,
      sticker: stickerEnv,
      ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {})
    }
  })
})

// Calibration endpoint with SSE progress streaming
app.post('/calibration', async c => {
  const body = await c.req.json()

  // Validate request
  if (!body.image) {
    return c.json({ success: false, error: 'Missing image data' }, 400)
  }

  if (!body.variations || !Array.isArray(body.variations) || body.variations.length === 0) {
    return c.json({ success: false, error: 'Missing or empty variations array' }, 400)
  }

  // Parse base64 image
  let imageData: Buffer
  try {
    // Remove data URL prefix if present
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '')
    imageData = Buffer.from(base64Data, 'base64')
  } catch {
    return c.json({ success: false, error: 'Invalid base64 image data' }, 400)
  }

  // Use SSE for progress updates
  return streamSSE(c, async stream => {
    try {
      const result = await generateCalibrationSheetWithProgress(
        {
          imageData,
          paperSize: body.paperSize || 'Letter',
          grid: body.grid || [2, 4],
          dpi: body.dpi || 600,
          variations: body.variations
        },
        async (step, total, message) => {
          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify({ step, total, message })
          })
        }
      )

      // Send final result
      await stream.writeSSE({
        event: 'complete',
        data: JSON.stringify({
          success: true,
          data: {
            image: `data:image/tiff;base64,${result.data.toString('base64')}`,
            filename: result.filename,
            gridSize: body.grid || [2, 4],
            variationCount: body.variations.length
          }
        })
      })
    } catch (err) {
      console.error('Calibration error:', err)
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      })
    }
  })
})

// Export endpoint
app.post('/export', async c => {
  try {
    const body = await c.req.json()

    // Validate request
    if (!body.image) {
      return c.json({ success: false, error: 'Missing image data' }, 400)
    }

    // Parse base64 image
    let imageData: Buffer
    try {
      // Remove data URL prefix if present
      const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '')
      imageData = Buffer.from(base64Data, 'base64')
    } catch {
      return c.json({ success: false, error: 'Invalid base64 image data' }, 400)
    }

    // Export image
    const format = body.format || 'tiff'
    const dpi = body.dpi || 300
    const result = await exportImage({
      imageData,
      format,
      dpi,
      colorProfile: body.colorProfile,
      args: body.args
    })

    // Determine MIME type
    const mimeTypes: Record<string, string> = {
      tiff: 'image/tiff',
      png: 'image/png',
      jpeg: 'image/jpeg'
    }

    return c.json({
      success: true,
      data: {
        image: `data:${mimeTypes[format]};base64,${result.data.toString('base64')}`,
        filename: result.filename,
        format,
        dpi,
        sizeBytes: result.data.length
      }
    })
  } catch (err) {
    console.error('Export error:', err)
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      500
    )
  }
})

// Sticker endpoint — spawns the Python sidecar pipeline
app.post('/sticker', async c => {
  try {
    const body = (await c.req.json()) as {
      images?: { filename?: string; data?: string }[]
      copies?: number
      size?: number
      offsetInches?: number
      test?: boolean
    }

    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return c.json({ success: false, error: 'Missing images array' }, 400)
    }

    const stickerImages: StickerImageInput[] = body.images.map((img, idx) => {
      if (!img.data) {
        throw new Error(`images[${idx}] missing data`)
      }
      const base64 = img.data.replace(/^data:image\/\w+;base64,/, '')
      return {
        filename: img.filename || `image_${idx}.png`,
        data: Buffer.from(base64, 'base64')
      }
    })

    const result = await processSticker({
      images: stickerImages,
      copies: body.copies,
      size: body.size,
      offsetInches: body.offsetInches,
      test: body.test
    })

    return c.json({
      success: true,
      data: {
        image: `data:image/jpeg;base64,${result.data.toString('base64')}`,
        filename: result.filename,
        sizeBytes: result.data.length,
        stdout: result.stdout,
        stderr: result.stderr
      }
    })
  } catch (err) {
    console.error('Sticker error:', err)
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      500
    )
  }
})

// 404 handler
app.notFound(c => {
  return c.json({ success: false, error: 'Route not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ success: false, error: 'Internal server error' }, 500)
})

// Start server
const port = 8787

async function main() {
  // Check ImageMagick availability
  const hasImageMagick = await checkImageMagick()
  if (!hasImageMagick) {
    console.warn('ImageMagick not found in PATH!')
    console.warn('Please install ImageMagick: https://imagemagick.org/script/download.php')
    console.warn('Server will start but processing endpoints will fail.\n')
  } else {
    console.log('ImageMagick detected')
  }

  console.log(`Craft Local Server starting on port ${port}`)
  console.log(`Endpoints:`)
  console.log(`  GET  /craft/api/health`)
  console.log(`  POST /craft/api/calibration`)
  console.log(`  POST /craft/api/export`)
  console.log(`  POST /craft/api/sticker`)
  console.log('')
  console.log('Ensure Cloudflare Tunnel is running to receive requests from hadoku.me')

  serve({
    fetch: app.fetch,
    port
  })
}

main().catch(console.error)

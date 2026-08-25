import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  HealthResponseSchema,
  ErrorResponseSchema,
  CalibrationRequestSchema,
  CalibrationResponseSchema,
  ExportRequestSchema,
  ExportResponseSchema
} from './schemas'

export function createCraftHandler(basePath: string) {
  const app = new OpenAPIHono().basePath(basePath)

  const healthRoute = createRoute({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    summary: 'Health check',
    description: 'Returns the health status of the API',
    responses: {
      200: {
        description: 'API is healthy',
        content: { 'application/json': { schema: HealthResponseSchema } }
      }
    }
  })

  app.openapi(healthRoute, c => {
    return c.json(
      {
        success: true as const,
        data: {
          status: 'healthy' as const,
          service: 'craft-api' as const,
          timestamp: new Date().toISOString(),
          note: 'Processing requests are forwarded to local server via Cloudflare Tunnel'
        }
      },
      200
    )
  })

  const calibrationRoute = createRoute({
    method: 'post',
    path: '/calibration',
    tags: ['Processing'],
    summary: 'Generate calibration sheet',
    description: `
Generates a calibration sheet with multiple image variations using ImageMagick.

**Note:** This endpoint is processed by a local server via Cloudflare Tunnel.
The local server must be running for this endpoint to work.
    `.trim(),
    request: {
      body: {
        content: { 'application/json': { schema: CalibrationRequestSchema } }
      }
    },
    responses: {
      200: {
        description: 'Calibration sheet generated successfully',
        content: { 'application/json': { schema: CalibrationResponseSchema } }
      },
      500: {
        description: 'Processing error',
        content: { 'application/json': { schema: ErrorResponseSchema } }
      },
      503: {
        description: 'Local processing server unavailable (tunnel down)',
        content: { 'application/json': { schema: ErrorResponseSchema } }
      }
    }
  })

  app.openapi(calibrationRoute, c => {
    return c.json(
      {
        success: false as const,
        error:
          'This endpoint requires the local processing server. Requests should be routed through edge-router to the Cloudflare Tunnel.'
      },
      503
    )
  })

  const exportRoute = createRoute({
    method: 'post',
    path: '/export',
    tags: ['Processing'],
    summary: 'Export image with DPI',
    description: `
Converts an image to the specified format with DPI metadata using ImageMagick.

**Note:** This endpoint is processed by a local server via Cloudflare Tunnel.
The local server must be running for this endpoint to work.
    `.trim(),
    request: {
      body: {
        content: { 'application/json': { schema: ExportRequestSchema } }
      }
    },
    responses: {
      200: {
        description: 'Image exported successfully',
        content: { 'application/json': { schema: ExportResponseSchema } }
      },
      500: {
        description: 'Processing error',
        content: { 'application/json': { schema: ErrorResponseSchema } }
      },
      503: {
        description: 'Local processing server unavailable (tunnel down)',
        content: { 'application/json': { schema: ErrorResponseSchema } }
      }
    }
  })

  app.openapi(exportRoute, c => {
    return c.json(
      {
        success: false as const,
        error:
          'This endpoint requires the local processing server. Requests should be routed through edge-router to the Cloudflare Tunnel.'
      },
      503
    )
  })

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Craft API',
      version: '1.0.0',
      description: `
Print calibration and export API powered by ImageMagick.

## Architecture

This API uses a hybrid architecture:
- **Schema/Health**: Served by Cloudflare Worker (always available)
- **Processing**: Handled by local server via Cloudflare Tunnel (requires tunnel active)
      `.trim()
    },
    servers: [
      { url: 'https://hadoku.me/craft/api', description: 'Production' },
      { url: 'http://localhost:8787/craft/api', description: 'Local development' }
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoint' },
      { name: 'Processing', description: 'Image processing endpoints (requires local server)' }
    ]
  })

  app.notFound(c => {
    return c.json({ success: false, error: 'Route not found' }, 404)
  })

  app.onError((_err, c) => {
    return c.json({ success: false, error: 'Internal server error' }, 500)
  })

  return app
}

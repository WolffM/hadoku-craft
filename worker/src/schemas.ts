import { z } from '@hono/zod-openapi'

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string()
})

export const HealthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal('healthy'),
    service: z.literal('craft-api'),
    timestamp: z.string(),
    note: z.string().optional()
  })
})

export const ImageVariationSchema = z.object({
  label: z.string().openapi({
    example: 'Saturation +10%',
    description: 'Human-readable label for this variation'
  }),
  args: z.array(z.string()).openapi({
    example: ['-modulate', '100,110,100'],
    description: 'ImageMagick convert arguments for this variation'
  })
})

export const CalibrationRequestSchema = z.object({
  image: z.string().openapi({
    description: 'Base64-encoded source image (PNG/JPEG)',
    example: 'data:image/png;base64,iVBORw0KGgo...'
  }),
  paperSize: z.enum(['Letter', 'A4', 'Legal', 'Tabloid']).default('Letter').openapi({
    description: 'Target paper size for the calibration sheet',
    example: 'Letter'
  }),
  grid: z
    .tuple([z.number(), z.number()])
    .default([2, 4])
    .openapi({
      description: 'Grid layout [columns, rows] for variations',
      example: [2, 4]
    }),
  dpi: z.number().min(72).max(1200).default(600).openapi({
    description: 'Output DPI for the calibration sheet',
    example: 600
  }),
  variations: z
    .array(ImageVariationSchema)
    .min(1)
    .max(20)
    .openapi({
      description: 'List of ImageMagick variations to apply',
      example: [
        { label: 'Baseline', args: [] },
        { label: 'Sat +10%', args: ['-modulate', '100,110,100'] },
        { label: 'Sat +20%', args: ['-modulate', '100,120,100'] },
        { label: 'Contrast +5%', args: ['-brightness-contrast', '0x5'] }
      ]
    })
})

export const CalibrationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    image: z.string().openapi({
      description: 'Base64-encoded calibration sheet (TIFF)'
    }),
    filename: z.string().openapi({
      example: 'calibration-sheet.tif'
    }),
    gridSize: z.tuple([z.number(), z.number()]),
    variationCount: z.number()
  })
})

export const ExportRequestSchema = z.object({
  image: z.string().openapi({
    description: 'Base64-encoded source image (PNG/JPEG)',
    example: 'data:image/png;base64,iVBORw0KGgo...'
  }),
  format: z.enum(['tiff', 'png', 'jpeg']).default('tiff').openapi({
    description: 'Output format',
    example: 'tiff'
  }),
  dpi: z.number().min(72).max(1200).default(300).openapi({
    description: 'Output DPI metadata',
    example: 300
  }),
  colorProfile: z.enum(['sRGB', 'AdobeRGB', 'ProPhotoRGB']).optional().openapi({
    description: 'Optional color profile to embed',
    example: 'sRGB'
  }),
  args: z
    .array(z.string())
    .optional()
    .openapi({
      description: 'Additional ImageMagick arguments',
      example: ['-modulate', '100,115,100']
    })
})

export const ExportResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    image: z.string().openapi({
      description: 'Base64-encoded output image'
    }),
    filename: z.string().openapi({
      example: 'output.tif'
    }),
    format: z.string(),
    dpi: z.number(),
    sizeBytes: z.number()
  })
})

export type CalibrationRequest = z.infer<typeof CalibrationRequestSchema>
export type CalibrationResponse = z.infer<typeof CalibrationResponseSchema>
export type ExportRequest = z.infer<typeof ExportRequestSchema>
export type ExportResponse = z.infer<typeof ExportResponseSchema>
export type ImageVariation = z.infer<typeof ImageVariationSchema>

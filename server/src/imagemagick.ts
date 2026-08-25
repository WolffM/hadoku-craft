/**
 * ImageMagick Integration
 *
 * Runs ImageMagick commands using child_process.
 * Requires ImageMagick to be installed on the system.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

const execFileAsync = promisify(execFile)

// Options to hide CMD window on Windows
const execOptions = {
  windowsHide: true,
  maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large images
}

// Paper sizes in pixels at 600 DPI
const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  Letter: { width: 5100, height: 6600 }, // 8.5" x 11" at 600 DPI
  A4: { width: 4961, height: 7016 }, // 210mm x 297mm at 600 DPI
  Legal: { width: 5100, height: 8400 }, // 8.5" x 14" at 600 DPI
  Tabloid: { width: 6600, height: 10200 } // 11" x 17" at 600 DPI
}

interface ImageVariation {
  label: string
  args: string[]
}

interface CalibrationOptions {
  imageData: Buffer
  paperSize: 'Letter' | 'A4' | 'Legal' | 'Tabloid'
  grid: [number, number]
  dpi: number
  variations: ImageVariation[]
}

interface ExportOptions {
  imageData: Buffer
  format: 'tiff' | 'png' | 'jpeg'
  dpi: number
  colorProfile?: 'sRGB' | 'AdobeRGB' | 'ProPhotoRGB'
  args?: string[]
}

/**
 * Create a unique temp directory for processing
 */
async function createTempDir(): Promise<string> {
  const id = randomBytes(8).toString('hex')
  const dir = join(tmpdir(), `craft-${id}`)
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Clean up temp directory
 */
async function cleanupTempDir(dir: string, files: string[]): Promise<void> {
  for (const file of files) {
    try {
      await unlink(join(dir, file))
    } catch {
      // Ignore cleanup errors
    }
  }
  try {
    await unlink(dir)
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if ImageMagick is installed
 */
export async function checkImageMagick(): Promise<boolean> {
  try {
    await execFileAsync('magick', ['--version'], execOptions)
    return true
  } catch {
    try {
      // Try legacy 'convert' command
      await execFileAsync('convert', ['--version'], execOptions)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Get the ImageMagick command (magick or convert)
 */
async function getConvertCommand(): Promise<string> {
  try {
    await execFileAsync('magick', ['--version'], execOptions)
    return 'magick'
  } catch {
    return 'convert'
  }
}

type ProgressCallback = (step: number, total: number, message: string) => Promise<void>

/**
 * Generate a calibration sheet with multiple image variations (with progress updates)
 */
export async function generateCalibrationSheetWithProgress(
  options: CalibrationOptions,
  onProgress?: ProgressCallback
): Promise<{ data: Buffer; filename: string }> {
  const { imageData, paperSize, grid, dpi, variations } = options
  const [cols, rows] = grid
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.Letter

  // Calculate total steps: variations + labeled versions + montage
  const numVariations = Math.min(variations.length, cols * rows)
  const totalSteps = numVariations * 2 + 1 // variations + labels + montage
  let currentStep = 0

  const progress = async (message: string) => {
    currentStep++
    if (onProgress) {
      await onProgress(currentStep, totalSteps, message)
    }
  }

  // Scale paper size to requested DPI
  const scale = dpi / 600
  const pageWidth = Math.round(paper.width * scale)
  const pageHeight = Math.round(paper.height * scale)

  const tempDir = await createTempDir()
  const tempFiles: string[] = []
  const convertCmd = await getConvertCommand()

  try {
    // Write source image to temp file
    const sourceFile = 'source.png'
    await writeFile(join(tempDir, sourceFile), imageData)
    tempFiles.push(sourceFile)

    // Calculate cell size (with margins)
    const margin = Math.round(50 * scale)
    const labelHeight = Math.round(40 * scale)
    const cellWidth = Math.floor((pageWidth - margin * 2) / cols)
    const cellHeight = Math.floor((pageHeight - margin * 2) / rows)
    const imageHeight = cellHeight - labelHeight

    // Generate each variation
    const variationFiles: string[] = []
    for (let i = 0; i < numVariations; i++) {
      const variation = variations[i]
      const outputFile = `var-${i}.png`

      // Build ImageMagick command for this variation
      const args = [
        join(tempDir, sourceFile),
        '-resize',
        `${cellWidth}x${imageHeight}>`,
        '-gravity',
        'center',
        '-extent',
        `${cellWidth}x${imageHeight}`,
        ...variation.args,
        join(tempDir, outputFile)
      ]

      if (convertCmd === 'magick') {
        await execFileAsync('magick', args, execOptions)
      } else {
        await execFileAsync('convert', args, execOptions)
      }

      tempFiles.push(outputFile)
      variationFiles.push(outputFile)
      await progress(`Processing variation ${i + 1}: ${variation.label}`)
    }

    // Create labeled versions with text overlay
    const labeledFiles: string[] = []
    for (let i = 0; i < variationFiles.length; i++) {
      const variation = variations[i]
      const inputFile = variationFiles[i]
      const labeledFile = `labeled-${i}.png`

      // Add label below image
      const args = [
        join(tempDir, inputFile),
        '-gravity',
        'south',
        '-background',
        'white',
        '-splice',
        `0x${labelHeight}`,
        '-gravity',
        'south',
        '-font',
        'Arial',
        '-pointsize',
        `${Math.round(20 * scale)}`,
        '-fill',
        'black',
        '-annotate',
        '+0+5',
        variation.label,
        join(tempDir, labeledFile)
      ]

      if (convertCmd === 'magick') {
        await execFileAsync('magick', args, execOptions)
      } else {
        await execFileAsync('convert', args, execOptions)
      }

      tempFiles.push(labeledFile)
      labeledFiles.push(labeledFile)
      await progress(`Adding label ${i + 1}: ${variation.label}`)
    }

    // Use montage to create the grid
    const outputFile = 'calibration-sheet.tif'
    const montageArgs = [
      'montage',
      ...labeledFiles.map(f => join(tempDir, f)),
      '-tile',
      `${cols}x${rows}`,
      '-geometry',
      `+${Math.round(10 * scale)}+${Math.round(10 * scale)}`,
      '-background',
      'white',
      '-density',
      `${dpi}`,
      join(tempDir, outputFile)
    ]

    // On Windows, montage needs to be called via 'magick montage'
    if (convertCmd === 'magick') {
      await execFileAsync('magick', montageArgs, execOptions)
    } else {
      // Remove 'montage' from args for legacy command
      await execFileAsync('montage', montageArgs.slice(1), execOptions)
    }
    tempFiles.push(outputFile)
    await progress('Creating final calibration sheet')

    // Read and return the result
    const result = await readFile(join(tempDir, outputFile))

    return {
      data: result,
      filename: 'calibration-sheet.tif'
    }
  } finally {
    await cleanupTempDir(tempDir, tempFiles)
  }
}

/**
 * Export an image to a specific format with DPI metadata
 */
export async function exportImage(
  options: ExportOptions
): Promise<{ data: Buffer; filename: string }> {
  const { imageData, format, dpi, colorProfile, args = [] } = options

  const tempDir = await createTempDir()
  const tempFiles: string[] = []
  const convertCmd = await getConvertCommand()

  try {
    // Write source image to temp file
    const sourceFile = 'source.png'
    await writeFile(join(tempDir, sourceFile), imageData)
    tempFiles.push(sourceFile)

    // Determine output extension
    const ext = format === 'tiff' ? 'tif' : format
    const outputFile = `output.${ext}`

    // Build ImageMagick command
    const cmdArgs = [
      join(tempDir, sourceFile),
      '-density',
      `${dpi}`,
      '-units',
      'PixelsPerInch',
      ...args
    ]

    // Add color profile if specified
    if (colorProfile) {
      // Note: Color profile files would need to be available
      // For now, we'll just set the colorspace
      const colorspace =
        colorProfile === 'sRGB' ? 'sRGB' : colorProfile === 'AdobeRGB' ? 'RGB' : 'RGB'
      cmdArgs.push('-colorspace', colorspace)
    }

    // Add format-specific options
    if (format === 'tiff') {
      cmdArgs.push('-compress', 'lzw')
    } else if (format === 'jpeg') {
      cmdArgs.push('-quality', '95')
    }

    cmdArgs.push(join(tempDir, outputFile))

    if (convertCmd === 'magick') {
      await execFileAsync('magick', cmdArgs, execOptions)
    } else {
      await execFileAsync('convert', cmdArgs, execOptions)
    }

    tempFiles.push(outputFile)

    // Read and return the result
    const result = await readFile(join(tempDir, outputFile))

    return {
      data: result,
      filename: `output.${ext}`
    }
  } finally {
    await cleanupTempDir(tempDir, tempFiles)
  }
}

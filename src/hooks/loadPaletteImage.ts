/**
 * Image loader for the palette route.
 *
 * Distinct from `loadImageFile`, which produces the `ImageFile` record the
 * print modes pass around (data URL + dimensions). The palette route needs the
 * decoded <img> element to draw and its RGBA buffer to sample, and never needs
 * the data URL — so it loads once and keeps both.
 */

import { readImagePixels, type RgbaImage } from '../domain/palette/sampling'

/** What the palette canvas can actually decode and sample. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface PaletteImage {
  element: HTMLImageElement
  pixels: RgbaImage
  name: string
}

export async function loadPaletteImage(file: File): Promise<PaletteImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Use JPG, PNG or WebP.`)
  }

  const element = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result
      if (typeof dataUrl !== 'string') {
        reject(new Error('Failed to read file'))
        return
      }
      const img = new Image()
      img.onload = () => {
        resolve(img)
      }
      img.onerror = () => {
        reject(new Error('Failed to decode image'))
      }
      img.src = dataUrl
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })

  return { element, pixels: readImagePixels(element), name: file.name }
}

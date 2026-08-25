/**
 * Shared multi-image upload + thumbnail grid.
 *
 * Used by collage / mtg custom-assets / sticker modes. Pure UI — the parent
 * owns the image list, this component loads new files (FileReader + decode)
 * and reports them via `onAdd`. The optional `decorate` hook lets each mode
 * attach its own metadata onto the loaded PooledImage.
 */

import React, { useCallback, useRef, useState } from 'react'
import { logger } from '@wolffm/logger/client'
import type { PooledImage } from '../../domain/types'
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_EXTENSIONS } from '../../domain/constants'

export interface ImagePoolProps<T extends PooledImage> {
  /** Current images in the pool. */
  images: T[]
  /** Called with freshly-loaded pooled images after a file selection. */
  onAdd: (images: T[]) => void
  /** Remove one image by id. */
  onRemove: (id: string) => void
  /** Remove every image. */
  onClear: () => void
  /**
   * Optional factory to attach mode-specific metadata onto each loaded image.
   * If omitted, the parent receives `PooledImage[]` (callers must accept this).
   */
  decorate?: (img: PooledImage) => T
  /** Heading text shown above the dropzone. */
  title?: string
  /** Optional content rendered next to the title (e.g. coverage stats). */
  rightSlot?: React.ReactNode
  /**
   * Per-image overlay/badge (e.g. "used" in collage layout). Receives the
   * decorated image; returns React node to render absolute-positioned over
   * the thumbnail.
   */
  renderBadge?: (image: T) => React.ReactNode
  /** Whether to highlight an image (e.g. when used in current collage). */
  isHighlighted?: (image: T) => boolean
  /** Override allowed MIME types. Defaults to ACCEPTED_IMAGE_TYPES. */
  accept?: readonly string[]
  /** Override accept attribute for the file input. */
  acceptAttr?: string
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = dataUrl
  })
}

export function ImagePool<T extends PooledImage = PooledImage>({
  images,
  onAdd,
  onRemove,
  onClear,
  decorate,
  title = 'Images',
  rightSlot,
  renderBadge,
  isHighlighted,
  accept = ACCEPTED_IMAGE_TYPES,
  acceptAttr = ACCEPTED_EXTENSIONS
}: ImagePoolProps<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFiles = useCallback(
    async (input: FileList | File[]) => {
      const files = Array.from(input).filter(f => accept.includes(f.type))
      if (files.length === 0) return

      setIsLoading(true)
      setProgress({ current: 0, total: files.length })

      const loaded: T[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const dataUrl = await readAsDataUrl(file)
          const { width, height } = await measureImage(dataUrl)
          const base: PooledImage = {
            id: genId(),
            file,
            dataUrl,
            name: file.name,
            width,
            height
          }
          loaded.push(decorate ? decorate(base) : (base as T))
        } catch (err) {
          logger.error('[ImagePool] Failed to load image', {
            name: file.name,
            error: err instanceof Error ? err.message : 'Unknown'
          })
        }
        setProgress({ current: i + 1, total: files.length })
      }

      if (loaded.length > 0) onAdd(loaded)
      setIsLoading(false)
      setProgress({ current: 0, total: 0 })
    },
    [accept, decorate, onAdd]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void handleFiles(e.target.files)
        e.target.value = ''
      }
    },
    [handleFiles]
  )

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="craft-image-pool">
      <div className="craft-image-pool__header">
        <h3 className="craft-image-pool__title">
          {title} ({images.length})
        </h3>
        <div className="craft-image-pool__header-right">
          {rightSlot}
          {images.length > 0 && (
            <button type="button" className="craft-image-pool__clear-btn" onClick={onClear}>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div
        className={`craft-image-pool__dropzone${
          isDragOver ? ' craft-image-pool__dropzone--dragover' : ''
        }${isLoading ? ' craft-image-pool__dropzone--loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={isLoading ? undefined : handleAddClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleAddClick()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttr}
          multiple
          className="craft-image-pool__input"
          onChange={handleInputChange}
          disabled={isLoading}
        />
        {isLoading ? (
          <div className="craft-image-pool__loading">
            <span className="craft-image-pool__spinner" />
            <span className="craft-image-pool__loading-text">
              Loading {progress.current} / {progress.total}
            </span>
            <div className="craft-image-pool__loading-bar">
              <div
                className="craft-image-pool__loading-fill"
                style={{
                  width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        ) : (
          <div className="craft-image-pool__dropzone-content">
            <span className="craft-image-pool__dropzone-icon">+</span>
            <span className="craft-image-pool__dropzone-text">
              Drop images here or click to add
            </span>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="craft-image-pool__thumbnails">
          {images.map(img => {
            const highlighted = isHighlighted?.(img) ?? false
            return (
              <div
                key={img.id}
                className={`craft-image-pool__thumbnail${
                  highlighted ? ' craft-image-pool__thumbnail--highlighted' : ''
                }`}
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="craft-image-pool__thumbnail-img"
                />
                <button
                  type="button"
                  className="craft-image-pool__thumbnail-remove"
                  onClick={e => {
                    e.stopPropagation()
                    onRemove(img.id)
                  }}
                  title={`Remove ${img.name}`}
                  aria-label={`Remove ${img.name}`}
                >
                  ×
                </button>
                {renderBadge?.(img)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

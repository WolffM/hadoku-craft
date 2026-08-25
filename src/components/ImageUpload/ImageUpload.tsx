/**
 * ImageUpload — single-image drag-and-drop + file picker.
 *
 * Self-contained: parent provides `image`, `onImageSelect`. Internal state
 * tracks loading/error during file decode. Multi-image flows use
 * `<ImagePool>` instead.
 */

import {
  useRef,
  useState,
  useCallback,
  type DragEvent,
  type ChangeEvent,
  type KeyboardEvent
} from 'react'
import { logger } from '@wolffm/logger/client'
import type { ImageFile } from '../../domain/types'
import { ACCEPTED_EXTENSIONS } from '../../domain/constants'
import { loadImageFile } from '../../hooks/loadImageFile'
import { ImagePreview } from './ImagePreview'

interface ImageUploadProps {
  image: ImageFile | null
  onImageSelect: (image: ImageFile | null) => void
  /** Label shown above the dropzone (full mode) or as the dropzone text (compact). */
  label?: string
  /** Smaller variant, used for secondary uploads (e.g. duplex back image). */
  compact?: boolean
}

export function ImageUpload({
  image,
  onImageSelect,
  label = 'Source Image',
  compact = false
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setIsLoading(true)
      setError(null)
      try {
        const imageFile = await loadImageFile(file)
        onImageSelect(imageFile)
        logger.info('[ImageUpload] Image loaded', { name: imageFile.name })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load image'
        setError(message)
        logger.error('[ImageUpload] Error loading image', { error: message })
      } finally {
        setIsLoading(false)
      }
    },
    [onImageSelect]
  )

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFile(file)
      e.target.value = ''
    },
    [handleFile]
  )

  const handleClear = useCallback(() => {
    onImageSelect(null)
    setError(null)
  }, [onImageSelect])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  const containerClass = compact
    ? 'craft-image-upload craft-image-upload--compact'
    : 'craft-image-upload'

  return (
    <div className={containerClass}>
      {!compact && <div className="craft-image-upload__label">{label}</div>}

      {image ? (
        <ImagePreview
          image={image}
          onClear={handleClear}
          label={compact ? label : undefined}
          compact={compact}
        />
      ) : (
        <div
          className={`craft-image-upload__dropzone ${
            isDragOver ? 'craft-image-upload__dropzone--active' : ''
          } ${error ? 'craft-image-upload__dropzone--error' : ''} ${
            compact ? 'craft-image-upload__dropzone--compact' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`${label}: Click or drop an image`}
        >
          {isLoading ? (
            <div className="craft-image-upload__loading">Loading...</div>
          ) : (
            <>
              <div className="craft-image-upload__icon">
                <svg
                  width={compact ? '32' : '48'}
                  height={compact ? '32' : '48'}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div className="craft-image-upload__text">
                {compact ? label : 'Drop image here or click to select'}
              </div>
              {!compact && (
                <div className="craft-image-upload__hint">PNG, JPG, TIFF, WebP, BMP</div>
              )}
            </>
          )}
        </div>
      )}

      {error && <div className="craft-image-upload__error">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        className="craft-image-upload__input"
        aria-hidden="true"
      />
    </div>
  )
}

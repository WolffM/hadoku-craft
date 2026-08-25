/**
 * ImagePreview Component
 * Displays an image preview with metadata
 */

import type { ImageFile } from '../../domain/types'

interface ImagePreviewProps {
  image: ImageFile
  maxHeight?: number
  showInfo?: boolean
  onClear?: () => void
  label?: string
  compact?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImagePreview({
  image,
  maxHeight = 200,
  showInfo = true,
  onClear,
  label,
  compact = false
}: ImagePreviewProps) {
  const containerClass = compact
    ? 'craft-image-preview craft-image-preview--compact'
    : 'craft-image-preview'

  return (
    <div className={containerClass}>
      {label && compact && <div className="craft-image-preview__label">{label}</div>}

      <div
        className="craft-image-preview__container"
        style={{ maxHeight: compact ? 100 : maxHeight }}
      >
        <img src={image.dataUrl} alt={image.name} className="craft-image-preview__image" />
      </div>

      {showInfo && !compact && (
        <div className="craft-image-preview__info">
          <span className="craft-image-preview__name" title={image.name}>
            {image.name}
          </span>
          <span className="craft-image-preview__dimensions">
            {image.width} × {image.height}
          </span>
          <span className="craft-image-preview__size">{formatFileSize(image.file.size)}</span>
        </div>
      )}

      {compact && (
        <div className="craft-image-preview__info craft-image-preview__info--compact">
          <span className="craft-image-preview__dimensions">
            {image.width} × {image.height}
          </span>
        </div>
      )}

      {onClear && (
        <button
          type="button"
          className="craft-image-preview__clear"
          onClick={onClear}
          aria-label="Clear image"
        >
          ×
        </button>
      )}
    </div>
  )
}

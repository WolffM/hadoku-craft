/**
 * CollageImagePool — collage-specific wrapper around the shared <ImagePool>.
 *
 * The pool itself is generic; this file owns the collage-specific bits:
 * decorating loaded images with `{selected: false}`, rendering the
 * "X used / X didn't fit / N% coverage" stats, and highlighting placed
 * images in the thumbnail grid.
 */

import type { CollagePoolImage, CollageLayoutResult, PooledImage } from '../../domain/types'
import { ImagePool } from '../shared/ImagePool'

interface CollageImagePoolProps {
  images: CollagePoolImage[]
  layoutResult: CollageLayoutResult | null
  onAddImages: (images: CollagePoolImage[]) => void
  onRemoveImage: (id: string) => void
  onClearAll: () => void
}

/** Add collage-specific metadata onto a freshly-loaded PooledImage. */
function decorateForCollage(img: PooledImage): CollagePoolImage {
  return {
    ...img,
    aspectRatio: img.width / img.height,
    selected: false
  }
}

export function CollageImagePool({
  images,
  layoutResult,
  onAddImages,
  onRemoveImage,
  onClearAll
}: CollageImagePoolProps) {
  const usedCount = layoutResult?.placements.length ?? 0
  const unusedCount = layoutResult?.unusedImageIds.length ?? 0
  const coverage = layoutResult ? Math.round(layoutResult.coverage * 100) : 0
  const placedIds = new Set(layoutResult?.placements.map(p => p.imageId) ?? [])

  return (
    <ImagePool<CollagePoolImage>
      title="Image Pool"
      images={images}
      decorate={decorateForCollage}
      onAdd={onAddImages}
      onRemove={onRemoveImage}
      onClear={onClearAll}
      isHighlighted={img => placedIds.has(img.id)}
      renderBadge={img =>
        placedIds.has(img.id) ? (
          <span className="craft-image-pool__used-badge" aria-label="Used in layout">
            ✓
          </span>
        ) : null
      }
      rightSlot={
        layoutResult ? (
          <div className="craft-image-pool__stats">
            <span className="craft-image-pool__stat craft-image-pool__stat--used">
              {usedCount} used
            </span>
            {unusedCount > 0 && (
              <span className="craft-image-pool__stat craft-image-pool__stat--unused">
                {unusedCount} didn't fit
              </span>
            )}
            <span className="craft-image-pool__stat craft-image-pool__stat--coverage">
              {coverage}% coverage
            </span>
          </div>
        ) : null
      }
    />
  )
}

export default CollageImagePool

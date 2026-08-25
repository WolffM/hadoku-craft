/**
 * DuplexSettings Component
 * Additional settings panel for Duplex (double-sided) printing mode
 */

import type { ImageFile } from '../../domain/types'
import { ImageUpload } from '../ImageUpload/ImageUpload'
import { SettingsPanel, SettingsSection, SettingsInfo } from '../shared/SettingsPanel'

interface DuplexSettingsProps {
  backImage: ImageFile | null
  onBackImageChange: (image: ImageFile | null) => void
  frontImageOrientation?: 'portrait' | 'landscape'
}

export function DuplexSettings({
  backImage,
  onBackImageChange,
  frontImageOrientation
}: DuplexSettingsProps) {
  const backImageOrientation = backImage
    ? backImage.width < backImage.height
      ? 'portrait'
      : 'landscape'
    : null

  const orientationMismatch =
    frontImageOrientation && backImageOrientation && frontImageOrientation !== backImageOrientation

  return (
    <SettingsPanel className="craft-duplex-settings">
      <SettingsSection
        title="Back Image"
        description="Upload the image for the back side of the postcards"
      >
        <ImageUpload
          image={backImage}
          onImageSelect={onBackImageChange}
          label="Drop back image here"
          compact
        />

        {orientationMismatch && (
          <div className="craft-duplex-settings__warning">
            <span className="craft-duplex-settings__warning-icon">⟳</span>
            <span>
              Back image will be auto-rotated to match front image orientation (
              {frontImageOrientation})
            </span>
          </div>
        )}

        <SettingsInfo>
          <p>
            <strong>Note:</strong> The back sheet will be automatically mirrored horizontally so
            that cards align correctly when printed double-sided (flip on long edge).
          </p>
        </SettingsInfo>
      </SettingsSection>
    </SettingsPanel>
  )
}

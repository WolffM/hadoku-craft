import { createRoot, type Root } from 'react-dom/client'
import { logger } from '@wolffm/logger/client'
import App from './App'
// REQUIRED: Import @wolffm/themes CSS - DO NOT REMOVE
import '@wolffm/themes/style.css'
// REQUIRED: Import theme picker CSS
import '@wolffm/task-ui-components/theme-picker.css'
import '@wolffm/task-ui-components/app-header.css'
// REQUIRED: toast styles for the palette route's notifications
import '@wolffm/task-ui-components/toaster.css'
import './styles/index.css'

// Props interface for configuration from parent app
export interface CraftProps {
  /**
   * The app's DISPLAY NAME, resolved by the platform from hadoku_site's
   * spec/categories.json — the same file that titles the browser tab and the
   * homepage tile. Render this; never hard-code the name in this repo.
   *
   * Absent when the app runs standalone (its own vite dev server, no host),
   * which is what `__HADOKU_APP_NAME__` covers — see vite.config.ts.
   */
  appName?: string
  theme?: string // Theme passed from parent (e.g., 'default', 'ocean', 'forest')
}

// Extend HTMLElement to include __root property
interface CraftElement extends HTMLElement {
  __root?: Root
}

// Mount function - called by parent to initialize your app
export function mount(el: HTMLElement, props: CraftProps = {}) {
  const root = createRoot(el)
  root.render(<App {...props} />)
  ;(el as CraftElement).__root = root
  logger.info('[hadoku-craft] Mounted successfully', { theme: props.theme })
}

// Unmount function - called by parent to cleanup your app
export function unmount(el: HTMLElement) {
  ;(el as CraftElement).__root?.unmount()
  logger.info('[hadoku-craft] Unmounted successfully')
}

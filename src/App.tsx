import { useRef, useState, type RefObject } from 'react'
import { AppHeader, LoadingSkeleton } from '@wolffm/task-ui-components'
import { useHadokuTheme, HadokuThemeRoot } from '@wolffm/themes'

import { RouteNav } from './components/RouteNav/RouteNav'
import { PrintRoute } from './components/PrintRoute/PrintRoute'
import { PaletteRoute } from './components/Palette/PaletteRoute'
import { ApiStatus } from './components/ApiStatus/ApiStatus'
import { useRoute } from './hooks/useRoute'
import { useApiStatus } from './hooks/useApiStatus'
import type { CraftProps } from './entry'

/**
 * Provider boundary. Theme state is the platform's (@wolffm/themes), not this
 * app's — the local hooks/useTheme.ts, prefs/themePrefs.ts and
 * app/themeConfig.tsx copies are gone. AppHeader renders the shared picker
 * from this context, so nothing below passes one.
 */
export default function App(props: CraftProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  return (
    <HadokuThemeRoot theme={props.theme} containerRef={containerRef}>
      <AppInner containerRef={containerRef} appName={props.appName} />
    </HadokuThemeRoot>
  )
}

/**
 * Shell: header, section nav, and whichever route the URL names.
 *
 * Each route owns its own state, so switching sections does not carry a
 * half-configured print job into the palette picker or vice versa — but React
 * keeps both unmounted trees out of memory entirely, so a switch is a reset.
 * That is the intended behaviour: they are separate tools.
 */
function AppInner({
  containerRef,
  appName
}: {
  containerRef: RefObject<HTMLDivElement | null>
  appName?: string
}) {
  const [systemPrefersDark] = useState(() =>
    window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  )

  const { route, navigate, href } = useRoute()
  const { theme, isDarkTheme, isThemeReady, isInitialThemeLoad } = useHadokuTheme()

  // Only the print modes call the backend, so only they report on it.
  const api = useApiStatus(route === 'print')

  if (isInitialThemeLoad && !isThemeReady) {
    return <LoadingSkeleton isDarkTheme={systemPrefersDark} />
  }

  return (
    <div
      ref={containerRef}
      className="craft-container"
      data-theme={theme}
      data-dark-theme={isDarkTheme ? 'true' : 'false'}
    >
      <div className="craft">
        <AppHeader
          title={appName ?? __HADOKU_APP_NAME__}
          status={
            route === 'print' ? <ApiStatus status={api.status} onRetry={api.retry} /> : undefined
          }
        />

        <RouteNav route={route} onNavigate={navigate} href={href} />

        <main className="craft__content">
          {route === 'print' ? <PrintRoute /> : <PaletteRoute />}
        </main>
      </div>
    </div>
  )
}

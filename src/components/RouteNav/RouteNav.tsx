/**
 * Top-level section switch: Print vs Palette.
 *
 * Renders real anchors rather than buttons so middle-click and ctrl-click open
 * a section in a new tab the way any other link would. A plain left click is
 * intercepted and handled with pushState instead, because a real navigation
 * would tear down the host page this app is mounted into.
 */

import type { MouseEvent } from 'react'
import { ROUTES, ROUTE_LABELS, type Route } from '../../routes'

interface RouteNavProps {
  route: Route
  onNavigate: (route: Route) => void
  href: (route: Route) => string
}

/** True for a click the browser would handle as a same-tab navigation. */
function isPlainLeftClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

export function RouteNav({ route, onNavigate, href }: RouteNavProps) {
  return (
    <nav className="craft-route-nav" aria-label="Craft sections">
      {ROUTES.map(id => (
        <a
          key={id}
          href={href(id)}
          className={`craft-route-nav__link ${route === id ? 'craft-route-nav__link--active' : ''}`}
          aria-current={route === id ? 'page' : undefined}
          onClick={e => {
            if (!isPlainLeftClick(e)) return
            e.preventDefault()
            onNavigate(id)
          }}
        >
          {ROUTE_LABELS[id]}
        </a>
      ))}
    </nav>
  )
}

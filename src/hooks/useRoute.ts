/**
 * Binds the top-level route to the address bar.
 *
 * pushState keeps the parent site's document intact — Craft is a micro-frontend
 * mounted into a page hadoku_site rendered, so a real navigation would tear
 * down the host. Back/forward still work because we listen for popstate.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseLocation, hrefFor, type Route } from '../routes'

export interface RouteControl {
  route: Route
  navigate: (route: Route) => void
  /** Href for a route, so nav items can be real links the browser can open. */
  href: (route: Route) => string
}

export function useRoute(): RouteControl {
  const [location, setLocation] = useState(() => parseLocation(window.location.pathname))

  // The base never changes for a given mount, but it is read inside `navigate`,
  // which must stay referentially stable — a ref keeps it out of the deps.
  const baseRef = useRef(location.base)
  baseRef.current = location.base

  useEffect(() => {
    const onPopState = () => {
      setLocation(parseLocation(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  const navigate = useCallback((next: Route) => {
    const target = hrefFor(baseRef.current, next)
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target)
    }
    setLocation({ base: baseRef.current, route: next })
  }, [])

  const href = useCallback((route: Route) => hrefFor(baseRef.current, route), [])

  return { route: location.route, navigate, href }
}

/**
 * Top-level routing for Craft.
 *
 * Craft is mounted by hadoku_site at `/craft`, and by vite at `/` in dev, so
 * the base path is not a constant this app can hard-code. Instead the last
 * path segment is matched against the known route ids: if it names a route,
 * everything before it is the base. That resolves `/craft/palette` and
 * `/palette` identically without either side declaring the other's prefix.
 *
 * Deliberately hand-rolled rather than a router dependency — there are two
 * routes with no params, and this app ships as a library into a host that
 * already owns the document.
 */

export const ROUTES = ['print', 'palette'] as const

export type Route = (typeof ROUTES)[number]

/** The route served at the mount root, i.e. with no trailing segment. */
export const DEFAULT_ROUTE: Route = 'print'

export const ROUTE_LABELS: Record<Route, string> = {
  print: 'Print',
  palette: 'Palette'
}

export interface Location {
  /** Mount path with no trailing slash, e.g. `/craft`. Empty string at root. */
  base: string
  route: Route
}

const isRoute = (value: string): value is Route => (ROUTES as readonly string[]).includes(value)

export function parseLocation(pathname: string): Location {
  const trimmed = pathname.replace(/\/+$/, '')
  const lastSlash = trimmed.lastIndexOf('/')
  const tail = lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1)

  if (isRoute(tail)) {
    return { base: lastSlash === -1 ? '' : trimmed.slice(0, lastSlash), route: tail }
  }
  return { base: trimmed, route: DEFAULT_ROUTE }
}

/**
 * The URL for `route` under `base`.
 *
 * The default route lives at the bare base rather than at `<base>/print`, so
 * the existing `/craft` links the parent site already publishes keep working.
 */
export function hrefFor(base: string, route: Route): string {
  if (route === DEFAULT_ROUTE) return base === '' ? '/' : base
  return `${base}/${route}`
}

/**
 * Backend health for the print route.
 *
 * Gated by `enabled` because only the print modes talk to the ImageMagick
 * server — the palette route is entirely client-side, and reporting "offline"
 * there would describe a backend it never calls.
 */

import { useCallback, useEffect, useState } from 'react'
import { logger } from '@wolffm/logger/client'
import { checkApiHealth } from '../api/craftApi'
import type { ApiStatusState } from '../components/ApiStatus/ApiStatus'

export interface ApiStatusControl {
  status: ApiStatusState
  retry: () => void
}

export function useApiStatus(enabled: boolean): ApiStatusControl {
  const [status, setStatus] = useState<ApiStatusState>('checking')

  const check = useCallback(async () => {
    setStatus('checking')
    const isHealthy = await checkApiHealth()
    setStatus(isHealthy ? 'online' : 'offline')
    logger.info('[useApiStatus] API health check', { status: isHealthy ? 'online' : 'offline' })
  }, [])

  const retry = useCallback(() => {
    check().catch(() => {
      /* checkApiHealth never rejects; this satisfies no-floating-promises */
    })
  }, [check])

  useEffect(() => {
    if (!enabled) return
    void check()
  }, [enabled, check])

  return { status, retry }
}

'use client'

import {
  versucheWhoopCloudAutoSync,
  whoopCloudAutoSyncIntervallMs,
} from '@/lib/fitnessdaten/whoop-cloud-auto-sync'
import { useEffect } from 'react'

/** Hintergrund-Sync: beim App-Start, Tab-Fokus und alle ~15 Min (WHOOP verbunden). */
export function WhoopCloudAutoSyncRunner() {
  useEffect(() => {
    const tick = (force = false) => {
      void versucheWhoopCloudAutoSync(force)
    }

    tick(true)

    const intervalMs = whoopCloudAutoSyncIntervallMs()
    const intervalId = window.setInterval(() => tick(false), intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  return null
}

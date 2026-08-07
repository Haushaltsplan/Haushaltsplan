'use client'

import { useEffect } from 'react'
import { pruefeFuehrungErinnerungen } from '@/lib/fuehrung/erinnerungen'

/**
 * Läuft app-weit: prüft regelmäßig Morgen-/Abend-Erinnerungen (wenn aktiv + Permission).
 */
export function FuehrungErinnerungenWatcher() {
  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void pruefeFuehrungErinnerungen()
    }

    tick()
    const id = window.setInterval(tick, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return null
}

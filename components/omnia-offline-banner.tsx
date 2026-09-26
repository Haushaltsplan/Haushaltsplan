'use client'

/** Offline-Banner wenn Remote-URL nicht erreichbar. */

import { useEffect, useState } from 'react'

export function OmniaOfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-[70] border-b border-amber-500/30 bg-amber-950/95 px-3 py-2 text-center text-sm text-amber-100 backdrop-blur-md"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      Keine Verbindung — einige Funktionen fehlen.{' '}
      <button
        type="button"
        className="app-touch-target ml-1 inline-flex items-center rounded-lg bg-amber-500/20 px-2 font-semibold underline-offset-2 hover:underline"
        onClick={() => window.location.reload()}
      >
        Erneut versuchen
      </button>
    </div>
  )
}

'use client'

import { ladeKalenderEintraegeVonQuelle } from '@/lib/haushalt-kalender'
import { useEffect, useRef } from 'react'

/**
 * Zieht Kalenderdaten von Supabase (falls konfiguriert) und spiegelt in localStorage,
 * bevor man die Kalender-Seite öffnet (erinnert, andere Tabs, …).
 */
export function KalenderCloudBootstrap() {
  const raf = useRef(false)
  useEffect(() => {
    if (raf.current) return
    raf.current = true
    void ladeKalenderEintraegeVonQuelle()
  }, [])
  return null
}

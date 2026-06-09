'use client'

import { WHOOP_SW_MESSAGE } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { useEffect } from 'react'

/**
 * Registriert periodischen Hintergrund-Sync (Android PWA) für WHOOP Cloud.
 * Echte BLE-Verbindung im geschlossenen Zustand ist per Web Bluetooth nicht möglich —
 * der SW holt Cloud-Daten und weckt offene Clients zum BLE-Reconnect.
 */
export function WhoopBleBackgroundSyncRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const { protocol, hostname } = window.location
    const sicher = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
    if (!sicher) return

    const registriere = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        if ('periodicSync' in reg) {
          const ps = reg as ServiceWorkerRegistration & {
            periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> }
          }
          await ps.periodicSync.register('whoop-cloud-sync', { minInterval: 15 * 60 * 1000 })
        }
        if ('sync' in reg) {
          const sw = reg as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> }
          }
          await sw.sync.register('whoop-cloud-sync')
        }
      } catch {
        /* Berechtigung verweigert oder nicht unterstützt */
      }
    }

    if (document.readyState === 'complete') void registriere()
    else window.addEventListener('load', () => void registriere(), { once: true })
  }, [])

  return null
}

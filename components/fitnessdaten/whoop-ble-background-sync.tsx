'use client'

import { WHOOP_SW_MESSAGE } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { useEffect } from 'react'

/**
 * Früher: Whoop-Cloud Periodic Sync.
 * Jetzt: nur SW-Messages für BLE-Reconnect-Hinweise (kein Cloud).
 */
export function WhoopBleBackgroundSyncRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === WHOOP_SW_MESSAGE || event.data?.type === 'whoop-background-sync') {
        window.dispatchEvent(new CustomEvent('whoop-ble-wake'))
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  return null
}

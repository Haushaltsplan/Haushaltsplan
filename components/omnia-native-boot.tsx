'use client'

import { installiereOmniaBleShim, istCapacitorNative } from '@/lib/omnia-native/omnia-ble-shim'
import {
  istOmniaHaushaltApp,
  istOmniaNativeApp,
  istOmniaWhoopApp,
} from '@/lib/omnia-native/omnia-native'
import { setzeOmniaNativeBereit } from '@/lib/omnia-native/omnia-native-ready'
import { setzeWhoopBleAlwaysOn } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

/**
 * Native Boot:
 * - Omnia Whoop → BLE-Shim
 * - Omnia Haushalt → kein BLE (kein Keepalive-Plugin-Aufruf — Crash-Schutz)
 */
export function OmniaNativeBoot() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const native = await new Promise<boolean>((resolve) => {
          if (istCapacitorNative() || istOmniaNativeApp()) {
            resolve(true)
            return
          }
          const t0 = Date.now()
          const id = window.setInterval(() => {
            if (istCapacitorNative() || istOmniaNativeApp()) {
              window.clearInterval(id)
              resolve(true)
            } else if (Date.now() - t0 > 4000) {
              window.clearInterval(id)
              resolve(false)
            }
          }, 80)
        })

        if (!native) {
          setzeOmniaNativeBereit(true)
          return
        }

        if (istOmniaHaushaltApp()) {
          try {
            setzeWhoopBleAlwaysOn(false)
          } catch {
            /* ignore */
          }
          if (!cancelled) setzeOmniaNativeBereit(true)
          return
        }

        if (!istOmniaWhoopApp()) {
          if (!cancelled) setzeOmniaNativeBereit(true)
          return
        }

        try {
          await installiereOmniaBleShim()
          if (!cancelled) setzeOmniaNativeBereit(true)
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : 'Bluetooth-Start fehlgeschlagen — Berechtigungen in den Android-Einstellungen prüfen.'
          if (!cancelled) {
            setzeOmniaNativeBereit(false, msg)
            toast.error(msg, { duration: 8000 })
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Native-Start fehlgeschlagen.'
        if (!cancelled) {
          setzeOmniaNativeBereit(false, msg)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}

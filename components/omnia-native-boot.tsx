'use client'

import { installiereOmniaBleShim, istCapacitorNative } from '@/lib/fitnessdaten/omnia-ble-shim'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { setzeOmniaNativeBereit } from '@/lib/fitnessdaten/omnia-native-ready'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

/**
 * Native Omnia (Capacitor): BLE-Plugin initialisieren + Web-Bluetooth-Shim.
 * Darf die App nie crashen — Fehler nur als Toast/Hinweis.
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

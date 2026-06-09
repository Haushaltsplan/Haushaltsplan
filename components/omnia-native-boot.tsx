'use client'

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useEffect, useState } from 'react'

/**
 * Native Omnia (Capacitor): BLE-Plugin initialisieren + Web-Bluetooth-Shim.
 * Danach funktioniert der bestehende WHOOP-Web-BLE-Code nativ inkl. Hintergrund.
 */
export function OmniaNativeBoot() {
  const [ready, setReady] = useState(!istOmniaNativeApp())

  useEffect(() => {
    if (!istOmniaNativeApp()) return
    let cancelled = false
    void (async () => {
      try {
        const { BluetoothLowEnergy } = await import('@capgo/capacitor-bluetooth-low-energy')
        await BluetoothLowEnergy.initialize({ mode: 'central' })
        await BluetoothLowEnergy.requestPermissions()
        BluetoothLowEnergy.shimWebBluetooth()
        if (!cancelled) setReady(true)
      } catch {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) return null
  return null
}

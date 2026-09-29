/**
 * Native BLE: Capgo-Plugin + Web-Bluetooth-Shim für WHOOP-Code.
 * Muss navigator.bluetooth setzen — sonst „Web Bluetooth nicht unterstützt“.
 */

import { Capacitor } from '@capacitor/core'

function hatAndroidBridge(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { androidBridge?: unknown }).androidBridge)
}

/** Läuft in der Omnia-APK (auch bei Remote-URL von Vercel)? */
export function istCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false
  return Capacitor.isNativePlatform() || hatAndroidBridge()
}

async function warteAufCapacitorBridge(maxMs = 4000): Promise<boolean> {
  if (istCapacitorNative()) return true
  const ende = Date.now() + maxMs
  while (Date.now() < ende) {
    await new Promise((r) => setTimeout(r, 80))
    if (istCapacitorNative()) return true
  }
  return istCapacitorNative()
}

function shimAktiv(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function installiereOmniaBleShim(): Promise<void> {
  const native = await warteAufCapacitorBridge()
  if (!native) {
    throw new Error(
      'Capacitor-Bridge nicht gefunden — läuft die Seite in der Omnia-App (nicht im Browser)?',
    )
  }

  const { BluetoothLowEnergy } = await import('@capgo/capacitor-bluetooth-low-energy')
  await BluetoothLowEnergy.initialize({ mode: 'central' })

  const perm = await BluetoothLowEnergy.requestPermissions()
  if (perm.bluetooth !== 'granted' || perm.location !== 'granted') {
    throw new Error(
      'Bluetooth-Berechtigungen fehlen. Einstellungen → Apps → Omnia → Berechtigungen → Bluetooth & Standort erlauben.',
    )
  }

  BluetoothLowEnergy.shimWebBluetooth()
  if (!shimAktiv()) {
    const mod = await import('@capgo/capacitor-bluetooth-low-energy/dist/esm/shim.js')
    mod.installBluetoothLowEnergyShim(BluetoothLowEnergy, {
      isNativePlatform: true,
      isPluginAvailable: true,
    })
  }

  if (!shimAktiv()) {
    throw new Error(
      'Bluetooth-Shim aktivieren fehlgeschlagen. App neu installieren (Android Studio → Run).',
    )
  }
}

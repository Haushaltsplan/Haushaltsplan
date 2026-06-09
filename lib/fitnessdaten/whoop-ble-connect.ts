/**
 * Einheitlicher WHOOP-BLE-Einstieg: Browser-PWA oder Omnia Native (Capacitor + BLE-Shim).
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { ladeOmniaNativeFehler, warteAufOmniaNativeBereit } from '@/lib/fitnessdaten/omnia-native-ready'
import {
  findeGespeichertesWhoopDevice,
  startWhoopNaeheWatcher,
  verbindeWhoopStandardHr,
  webBluetoothVerfuegbar,
  WHOOP_BLE_DEVICE_ID_KEY,
  type WhoopConnectOptions,
  type WhoopDeviceAuswahl,
  type WhoopWebBleDebug,
  type WhoopWebBlePhase,
  type WhoopWebBleSession,
} from '@/lib/fitnessdaten/web-bluetooth-whoop'

export type {
  WhoopConnectOptions,
  WhoopDeviceAuswahl,
  WhoopWebBleDebug,
  WhoopWebBlePhase,
  WhoopWebBleSession,
}
export { WHOOP_BLE_DEVICE_ID_KEY, findeGespeichertesWhoopDevice, startWhoopNaeheWatcher }

export function whoopBleVerfuegbar(): boolean {
  return webBluetoothVerfuegbar()
}

export function whoopBleHinweis(): string | null {
  if (!istOmniaNativeApp()) return null
  return ladeOmniaNativeFehler()
}

async function startNativeForegroundService(): Promise<void> {
  if (!istOmniaNativeApp()) return
  const { starteOmniaBleKeepalive } = await import('@/lib/fitnessdaten/omnia-ble-keepalive-native')
  await starteOmniaBleKeepalive()
}

async function stopNativeForegroundService(): Promise<void> {
  if (!istOmniaNativeApp()) return
  const { stoppeOmniaBleKeepalive } = await import('@/lib/fitnessdaten/omnia-ble-keepalive-native')
  await stoppeOmniaBleKeepalive()
}

export async function verbindeWhoopBle(
  onUpdate: (session: Omit<WhoopWebBleSession, 'disconnect'>) => void,
  auswahl: WhoopDeviceAuswahl = 'whoop',
  options?: WhoopConnectOptions,
): Promise<WhoopWebBleSession> {
  if (istOmniaNativeApp()) {
    const ok = await warteAufOmniaNativeBereit()
    if (!ok || !webBluetoothVerfuegbar()) {
      const err = ladeOmniaNativeFehler() ?? 'Bluetooth in der Omnia-App ist noch nicht bereit.'
      throw new Error(err)
    }
  }
  const session = await verbindeWhoopStandardHr(onUpdate, auswahl, options)

  if (istOmniaNativeApp()) {
    await startNativeForegroundService()
    const origDisconnect = session.disconnect
    return {
      ...session,
      disconnect: () => {
        void stopNativeForegroundService()
        origDisconnect()
      },
    }
  }

  return session
}

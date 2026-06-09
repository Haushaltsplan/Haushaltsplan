/**
 * Einheitlicher WHOOP-BLE-Einstieg: Browser-PWA oder Omnia Native (Capacitor + BLE-Shim).
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
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
  return istOmniaNativeApp() || webBluetoothVerfuegbar()
}

async function startNativeForegroundService(): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { BluetoothLowEnergy } = await import('@capgo/capacitor-bluetooth-low-energy')
    await BluetoothLowEnergy.startForegroundService({
      title: 'Omnia',
      body: 'WHOOP verbunden — Live-Daten aktiv',
      smallIcon: 'ic_launcher_foreground',
    })
  } catch {
    /* optional */
  }
}

async function stopNativeForegroundService(): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    const { BluetoothLowEnergy } = await import('@capgo/capacitor-bluetooth-low-energy')
    await BluetoothLowEnergy.stopForegroundService()
  } catch {
    /* optional */
  }
}

export async function verbindeWhoopBle(
  onUpdate: (session: Omit<WhoopWebBleSession, 'disconnect'>) => void,
  auswahl: WhoopDeviceAuswahl = 'whoop',
  options?: WhoopConnectOptions,
): Promise<WhoopWebBleSession> {
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

/**
 * Native Omnia: Bei Minimieren/Display-aus Capgo-BLE NICHT trennen —
 * nur Foreground-Service am Leben halten. Native GATT nur wenn WebView tot ist.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import {
  armeNativeWhoopLink,
  gebeNativeWhoopLinkFrei,
  starteOmniaBleKeepalive,
} from '@/lib/fitnessdaten/omnia-ble-keepalive-native'
import { istWhoopBleAlwaysOn } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { WHOOP_BLE_DEVICE_ID_KEY } from '@/lib/fitnessdaten/web-bluetooth-whoop'

let capgoDisconnect: (() => void) | null = null
/** true nur wenn wir Capgo absichtlich für nativen GATT abgegeben haben (selten). */
let handoffAktiv = false

export function registriereCapgoDisconnect(fn: () => void): void {
  capgoDisconnect = fn
}

export function entferneCapgoDisconnect(): void {
  capgoDisconnect = null
}

function ladeGeraetId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(WHOOP_BLE_DEVICE_ID_KEY)
}

/**
 * Display aus / App minimiert: Keepalive-Service sichern, Capgo-Verbindung behalten.
 */
export async function nativeHintergrundHandoff(live: boolean): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const deviceId = ladeGeraetId()
  try {
    await starteOmniaBleKeepalive(deviceId ?? undefined)
    // Wichtig: Capgo NICHT disconnecten — das war die Ursache für Verbindungsverlust.
    return live || Boolean(deviceId)
  } catch {
    return false
  }
}

/**
 * Harter Handoff (App aus Recents / Capgo tot): Capgo trennen, nativer GATT.
 * Wird nur manuell/selten genutzt — Standard ist Keep-Process ohne Disconnect.
 */
export async function nativeHarterGattHandoff(): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const deviceId = ladeGeraetId()
  if (!deviceId) return false
  handoffAktiv = true
  try {
    const disc = capgoDisconnect
    capgoDisconnect = null
    disc?.()
    await armeNativeWhoopLink(deviceId)
    return true
  } catch {
    handoffAktiv = false
    return false
  }
}

export async function nativeVordergrundUebernahme(
  reconnect: () => Promise<void>,
): Promise<void> {
  if (!istOmniaNativeApp()) return
  const warHandoff = handoffAktiv
  handoffAktiv = false
  try {
    await gebeNativeWhoopLinkFrei()
  } catch {
    /* ignore */
  }
  // Nach hartem Handoff Capgo neu verbinden; sonst nur nachziehen falls nötig
  await reconnect()
  void warHandoff
}

export function istNativeHandoffAktiv(): boolean {
  return handoffAktiv
}

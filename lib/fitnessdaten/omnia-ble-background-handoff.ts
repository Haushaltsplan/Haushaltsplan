/**
 * Hintergrund: Capgo trennen + nativer GATT im :whoopble-Prozess.
 * Der BLE-Dienst überlebt App-Schließen.
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * App geht in den Hintergrund / wird geschlossen:
 * 1) Keepalive-Service (:whoopble) starten
 * 2) Capgo disconnect
 * 3) Nativen GATT armen — läuft weiter wenn UI tot ist
 */
export async function nativeHintergrundHandoff(live: boolean): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const deviceId = ladeGeraetId()
  if (!deviceId) {
    try {
      await starteOmniaBleKeepalive()
    } catch {
      /* ignore */
    }
    return false
  }
  if (handoffAktiv) return true
  handoffAktiv = true
  try {
    await starteOmniaBleKeepalive(deviceId)
    // Zuerst Capgo freigeben, dann nativ verbinden (ein Central zur Zeit)
    const disc = capgoDisconnect
    capgoDisconnect = null
    try {
      disc?.()
    } catch {
      /* ignore */
    }
    await sleep(350)
    await armeNativeWhoopLink(deviceId)
    return live || true
  } catch {
    handoffAktiv = false
    return false
  }
}

export async function nativeHarterGattHandoff(): Promise<boolean> {
  return nativeHintergrundHandoff(true)
}

export async function nativeVordergrundUebernahme(
  reconnect: () => Promise<void>,
): Promise<void> {
  if (!istOmniaNativeApp()) return
  handoffAktiv = false
  try {
    await gebeNativeWhoopLinkFrei()
  } catch {
    /* ignore */
  }
  await sleep(200)
  await reconnect()
}

export function istNativeHandoffAktiv(): boolean {
  return handoffAktiv
}

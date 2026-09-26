/**
 * Nach Capgo-Erstverbindung: nativer :whoopble-Dienst übernimmt DAUERHAFT
 * (WHOOP-App-Modell). Capgo wird getrennt — UI bekommt HR über Plugin-Events.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import {
  armeNativeWhoopLink,
  starteOmniaBleKeepalive,
} from '@/lib/fitnessdaten/omnia-ble-keepalive-native'
import { istWhoopBleAlwaysOn } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { WHOOP_BLE_DEVICE_ID_KEY } from '@/lib/fitnessdaten/web-bluetooth-whoop'

let capgoDisconnect: (() => void) | null = null
let handoffAktiv = false
let permanentNative = false

export function registriereCapgoDisconnect(fn: () => void): void {
  capgoDisconnect = fn
}

export function entferneCapgoDisconnect(): void {
  capgoDisconnect = null
}

export function istPermanentNativeBle(): boolean {
  return permanentNative
}

function ladeGeraetId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(WHOOP_BLE_DEVICE_ID_KEY)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Einmal nach erfolgreichem Capgo-Connect: für immer an nativen Dienst übergeben. */
export async function uebergibBleDauerhaftAnNative(): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const deviceId = ladeGeraetId()
  handoffAktiv = true
  permanentNative = true
  try {
    await starteOmniaBleKeepalive(deviceId ?? undefined)
    const disc = capgoDisconnect
    capgoDisconnect = null
    try {
      disc?.()
    } catch {
      /* ignore */
    }
    await sleep(400)
    await armeNativeWhoopLink(deviceId ?? undefined)
    return true
  } catch {
    handoffAktiv = false
    permanentNative = false
    return false
  }
}

export async function nativeHintergrundHandoff(live: boolean): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  // Bereits dauerhaft nativ — nur Service anstupsen
  if (permanentNative || handoffAktiv) {
    try {
      await armeNativeWhoopLink(ladeGeraetId() ?? undefined)
      return true
    } catch {
      return false
    }
  }
  return uebergibBleDauerhaftAnNative().then((ok) => ok && live)
}

export async function nativeHarterGattHandoff(): Promise<boolean> {
  return uebergibBleDauerhaftAnNative()
}

export async function nativeVordergrundUebernahme(
  reconnect: () => Promise<void>,
): Promise<void> {
  if (!istOmniaNativeApp()) return
  // Native behält GATT — kein Capgo-Reconnect nötig wenn permanent
  if (permanentNative || handoffAktiv) {
    try {
      await armeNativeWhoopLink(ladeGeraetId() ?? undefined)
    } catch {
      /* ignore */
    }
    return
  }
  await reconnect()
}

export function istNativeHandoffAktiv(): boolean {
  return handoffAktiv || permanentNative
}

export function setzePermanentNative(an: boolean): void {
  permanentNative = an
  handoffAktiv = an
}

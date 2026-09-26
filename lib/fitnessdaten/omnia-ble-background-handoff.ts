/**
 * Nach Capgo-Connect: ZUERST Capgo trennen, DANN natives GATT — sonst Konflikt.
 * Handoff wird awaited (nicht void), damit vor App-Schließen fertig.
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

/** Einmal nach Capgo-Connect: natives GATT übernimmt dauerhaft. */
export async function uebergibBleDauerhaftAnNative(): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const deviceId = ladeGeraetId()
  if (!deviceId) {
    console.warn('[omnia-ble] keine deviceId — Handoff abgebrochen')
    return false
  }

  handoffAktiv = true
  permanentNative = true

  try {
    // FGS + ID speichern (noch bevor Capgo weg ist)
    await starteOmniaBleKeepalive(deviceId)

    // 1) Capgo ZUERST trennen — sonst blockiert natives connectGatt
    const disc = capgoDisconnect
    capgoDisconnect = null
    try {
      disc?.()
    } catch {
      /* ignore */
    }

    // 2) WHOOP braucht kurz, bis der alte Link weg ist
    await sleep(1500)

    // 3) Native verbinden (mehrfach anstupsen)
    await armeNativeWhoopLink(deviceId)
    await sleep(1000)
    await armeNativeWhoopLink(deviceId)
    await sleep(1000)
    await armeNativeWhoopLink(deviceId)

    return true
  } catch (e) {
    console.error('[omnia-ble] Handoff fehlgeschlagen', e)
    handoffAktiv = false
    permanentNative = false
    return false
  }
}

export async function nativeHintergrundHandoff(_live: boolean): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const id = ladeGeraetId()
  try {
    if (!permanentNative) {
      return uebergibBleDauerhaftAnNative()
    }
    await armeNativeWhoopLink(id ?? undefined)
    return true
  } catch {
    return false
  }
}

export async function nativeHarterGattHandoff(): Promise<boolean> {
  return uebergibBleDauerhaftAnNative()
}

export async function nativeVordergrundUebernahme(
  _reconnect: () => Promise<void>,
): Promise<void> {
  if (!istOmniaNativeApp()) return
  try {
    await armeNativeWhoopLink(ladeGeraetId() ?? undefined)
  } catch {
    /* ignore */
  }
}

export function istNativeHandoffAktiv(): boolean {
  return handoffAktiv || permanentNative
}

export function setzePermanentNative(an: boolean): void {
  permanentNative = an
  handoffAktiv = an
}

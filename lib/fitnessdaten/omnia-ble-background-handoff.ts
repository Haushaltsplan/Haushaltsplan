/**
 * Nach Capgo-Connect: nativer Dienst übernimmt dauerhaft.
 * Handoff-Reihenfolge: ID speichern → Service armen → Capgo trennen → erneut armen.
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

/** Einmal nach Capgo-Connect: nativer GATT übernimmt für immer. */
export async function uebergibBleDauerhaftAnNative(): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  const deviceId = ladeGeraetId()
  handoffAktiv = true
  permanentNative = true
  try {
    // 1) Service starten + ID setzen (noch während Capgo hält)
    await starteOmniaBleKeepalive(deviceId ?? undefined)
    await armeNativeWhoopLink(deviceId ?? undefined)
    await sleep(300)

    // 2) Capgo freigeben
    const disc = capgoDisconnect
    capgoDisconnect = null
    try {
      disc?.()
    } catch {
      /* ignore */
    }

    // 3) Nach Capgo-Disconnect hart reconnecten
    await sleep(600)
    await armeNativeWhoopLink(deviceId ?? undefined)
    await sleep(400)
    await armeNativeWhoopLink(deviceId ?? undefined)
    return true
  } catch {
    handoffAktiv = false
    permanentNative = false
    return false
  }
}

export async function nativeHintergrundHandoff(_live: boolean): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn()) return false
  try {
    await armeNativeWhoopLink(ladeGeraetId() ?? undefined)
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

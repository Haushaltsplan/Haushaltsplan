/**
 * Native Omnia: WHOOP-BLE von Capgo (WebView) an den Android Foreground Service übergeben,
 * wenn die App geschlossen/minimiert wird — Verbindung bleibt auf Radio-Ebene aktiv.
 */

import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import {
  armeNativeWhoopLink,
  gebeNativeWhoopLinkFrei,
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

export async function nativeHintergrundHandoff(live: boolean): Promise<boolean> {
  if (!istOmniaNativeApp() || !istWhoopBleAlwaysOn() || !live || handoffAktiv) return false
  const deviceId = ladeGeraetId()
  if (!deviceId) return false
  // Flag vor Capgo-Disconnect setzen, damit Auto-Reconnect nicht gegen nativen GATT läuft.
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
  if (warHandoff || istWhoopBleAlwaysOn()) {
    await reconnect()
  }
}

export function istNativeHandoffAktiv(): boolean {
  return handoffAktiv
}

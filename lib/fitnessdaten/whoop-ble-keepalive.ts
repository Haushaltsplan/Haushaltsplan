/** Einstellungen & Hilfslogik für dauerhafte WHOOP-BLE-Verbindung (PWA). */

export const WHOOP_BLE_ALWAYS_ON_KEY = 'mein-haushalt:whoop-ble-always-on'
export const WHOOP_BLE_SNAPSHOT_EVENT = 'mein-haushalt:whoop-ble-snapshot'
export const WHOOP_BLE_PHASE_EVENT = 'mein-haushalt:whoop-ble-phase'
export const WHOOP_SW_MESSAGE = 'whoop-background-sync'

/** Intervall für Reconnect-Versuche, wenn getrennt (auch im Hintergrund-Tab). */
export const WHOOP_BLE_RECONNECT_INTERVAL_MS = 12_000

/** Erster Reconnect nach Disconnect. */
export const WHOOP_BLE_RECONNECT_FAST_MS = 600

/** Max. Wartezeit zwischen Versuchen bei wiederholten Fehlern. */
export const WHOOP_BLE_RECONNECT_MAX_MS = 45_000

export function istWhoopBleAlwaysOn(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(WHOOP_BLE_ALWAYS_ON_KEY)
    if (v === '0' || v === 'false') return false
    return true
  } catch {
    return true
  }
}

export function setzeWhoopBleAlwaysOn(an: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WHOOP_BLE_ALWAYS_ON_KEY, an ? '1' : '0')
}

export function dispatchWhoopBleSnapshot(detail: unknown): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHOOP_BLE_SNAPSHOT_EVENT, { detail }))
}

export function dispatchWhoopBlePhase(detail: unknown): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHOOP_BLE_PHASE_EVENT, { detail }))
}

/** Nächstes Reconnect-Intervall (exponentielles Backoff). */
export function naechstesReconnectDelayMs(versuche: number): number {
  const base = WHOOP_BLE_RECONNECT_FAST_MS
  const ms = Math.min(WHOOP_BLE_RECONNECT_MAX_MS, base * Math.pow(1.6, Math.min(versuche, 8)))
  return Math.round(ms)
}

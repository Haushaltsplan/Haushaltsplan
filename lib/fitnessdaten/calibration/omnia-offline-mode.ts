/** Omnia Offline-Modus — Default an (kein Whoop-Abo/Cloud mehr). */

export const OMNIA_OFFLINE_MODE_KEY = 'mein-haushalt:omnia-offline-mode'
export const OMNIA_OFFLINE_MODE_EVENT = 'mein-haushalt:omnia-offline-mode'

/** Immer an — Cloud-Overrides werden ignoriert. */
export function istOmniaOfflineMode(): boolean {
  return true
}

export function setzeOmniaOfflineMode(_an: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OMNIA_OFFLINE_MODE_KEY, '1')
  window.dispatchEvent(new CustomEvent(OMNIA_OFFLINE_MODE_EVENT, { detail: { offline: true } }))
}

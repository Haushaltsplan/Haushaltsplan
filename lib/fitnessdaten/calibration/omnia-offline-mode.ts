/** Omnia Offline-Modus — nach Abo-Ende: lokale Shadows als Primärquelle. */

export const OMNIA_OFFLINE_MODE_KEY = 'mein-haushalt:omnia-offline-mode'
export const OMNIA_OFFLINE_MODE_EVENT = 'mein-haushalt:omnia-offline-mode'

export function istOmniaOfflineMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(OMNIA_OFFLINE_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function setzeOmniaOfflineMode(an: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OMNIA_OFFLINE_MODE_KEY, an ? '1' : '0')
  window.dispatchEvent(new CustomEvent(OMNIA_OFFLINE_MODE_EVENT, { detail: { offline: an } }))
}

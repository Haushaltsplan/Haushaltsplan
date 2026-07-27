/**
 * Sicheres localStorage: QuotaExceeded abfangen und große Caches freigeben.
 * Verhindert Abstürze von Start/Whoop, wenn der Browser-Speicher voll ist.
 */

const GROSSE_CACHE_KEYS = [
  // Portfolio-Analyse Caches (können sehr groß werden)
  'pa-fundamentaldaten-v1',
  'pa-fundamentaldaten-v2',
  'pa-earnings-call-unternehmen-v1',
  'pa-sec-berichte-unternehmen-v4',
  'pa-sec-berichte-unternehmen-v1',
  'pa-quartals-ki-diff-v1',
  'pa-isin-metadata-v1',
  'pa-ankuendigte-earnings-v1',
  'pa-ankuendigte-dividenden-v1',
  // Fitness Sync-Puffer
  'mein-haushalt:fitness-sync-buffer',
  'mein-haushalt:fitness-sync-state',
] as const

export function istQuotaFehler(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: number; message?: string }
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(String(e.message || ''))
  )
}

/** Entfernt große, neu ladbare Caches — Session/Auth bleiben erhalten. */
export function befreieLocalStorageQuota(): void {
  if (typeof window === 'undefined') return
  for (const key of GROSSE_CACHE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
  // Weitere pa-* / große Fitness-Keys heuristisch
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (k.startsWith('pa-') && k.includes('cache')) toRemove.push(k)
      if (k.startsWith('pa-') && /fundamental|earnings|sec-|quartals/i.test(k)) toRemove.push(k)
    }
    for (const k of toRemove) {
      try {
        window.localStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** setItem ohne Throw; bei Quota Caches löschen und einmal erneut versuchen. */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (err) {
    if (!istQuotaFehler(err)) return false
    befreieLocalStorageQuota()
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }
}

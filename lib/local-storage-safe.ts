/**
 * Sicheres localStorage: QuotaExceeded abfangen, große Caches freigeben,
 * Auth-Session (sb-*-auth-*) niemals löschen.
 *
 * Hintergrund: Wenn Whoop/Portfolio den Speicher füllen, schlägt das Speichern
 * des Supabase-Refresh-Tokens fehl → beim nächsten Besuch wirkt die App
 * „nicht gemerkt“, obwohl das Gerät vertrauenswürdig markiert ist.
 */

import type { SupportedStorage } from '@supabase/supabase-js'

const FITNESS_KEYS = [
  'mein-haushalt:fitnessdaten-daily',
  'mein-haushalt:fitnessdaten-history',
  'mein-haushalt:fitnessdaten-snapshot',
  'mein-haushalt:fitnessdaten-sync',
  'mein-haushalt:fitnessdaten-sync-buffer',
  'mein-haushalt:whoop-vo2-trends',
  'mein-haushalt:fitnessdaten-whoop-cloud',
] as const

const GROSSE_CACHE_KEYS = [
  'pa-fundamentaldaten-v1',
  'pa-fundamentaldaten-v2',
  'pa-fundamentaldaten-v55',
  'pa-fundamentaldaten-v56',
  'pa-earnings-call-unternehmen-v1',
  'pa-sec-berichte-unternehmen-v4',
  'pa-sec-berichte-unternehmen-v1',
  'pa-quartals-ki-diff-v1',
  'pa-isin-metadata-v1',
  'pa-ankuendigte-earnings-v1',
  'pa-ankuendigte-dividenden-v1',
  'mein-haushalt:fitnessdaten-sync',
  'mein-haushalt:fitnessdaten-sync-buffer',
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

/** Supabase- und Omnia-Auth-Keys — dürfen bei Quota-Bereinigung nie weg. */
export function istGeschuetzterAuthKey(key: string): boolean {
  if (key.startsWith('omnia-auth-')) return true
  if (key.startsWith('sb-') && key.includes('auth')) return true
  return false
}

function removeKeys(keys: readonly string[]) {
  if (typeof window === 'undefined') return
  for (const key of keys) {
    if (istGeschuetzterAuthKey(key)) continue
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Entfernt große, neu ladbare Daten.
 * `stufe`:
 *  - caches = Portfolio-Caches + Sync-Puffer
 *  - fitness = zusätzlich Tages-/History-Daten (Auth bleibt)
 */
export function befreieLocalStorageQuota(stufe: 'caches' | 'fitness' = 'caches'): void {
  if (typeof window === 'undefined') return

  removeKeys(GROSSE_CACHE_KEYS)

  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k || istGeschuetzterAuthKey(k)) continue
      if (k.startsWith('pa-') && /fundamental|earnings|sec-|quartals|cache|isin/i.test(k)) {
        toRemove.push(k)
      }
    }
    removeKeys(toRemove)
  } catch {
    /* ignore */
  }

  if (stufe === 'fitness') {
    removeKeys(FITNESS_KEYS)
  }
}

/** Grobe Schätzung: Summe der Value-Längen in localStorage. */
export function schaetzeLocalStorageBytes(): number {
  if (typeof window === 'undefined') return 0
  let n = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      const v = window.localStorage.getItem(k) || ''
      n += k.length + v.length
    }
  } catch {
    return n
  }
  return n * 2 // UTF-16
}

/**
 * Vor Auth/Whoop: wenn Speicher eng wird, Platz schaffen — Auth-Keys bleiben.
 * Typisches Quota ~5 MB; ab ~3.5 MB prophylaktisch Caches, ab ~4.5 MB Fitness.
 */
export function sichereSpeicherplatzFuerAuth(): void {
  if (typeof window === 'undefined') return
  const bytes = schaetzeLocalStorageBytes()
  if (bytes > 4_500_000) befreieLocalStorageQuota('fitness')
  else if (bytes > 3_200_000) befreieLocalStorageQuota('caches')
}

/** setItem ohne Throw; bei Quota Caches/Fitness freigeben und erneut versuchen. */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (err) {
    if (!istQuotaFehler(err)) return false
    befreieLocalStorageQuota('caches')
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch (err2) {
      if (!istQuotaFehler(err2)) return false
      befreieLocalStorageQuota('fitness')
      try {
        window.localStorage.setItem(key, value)
        return true
      } catch {
        return false
      }
    }
  }
}

/**
 * Storage-Adapter für Supabase Auth: Login-Session hat Vorrang vor Whoop-Caches.
 * Wenn das Speichern des Tokens am Quota scheitert, fliegen Caches — nicht die Session.
 */
export function createSupabaseAuthStorage(): SupportedStorage {
  return {
    getItem: (key) => {
      if (typeof window === 'undefined') return null
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key, value) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(key, value)
      } catch (err) {
        if (!istQuotaFehler(err)) throw err
        befreieLocalStorageQuota('caches')
        try {
          window.localStorage.setItem(key, value)
        } catch (err2) {
          if (!istQuotaFehler(err2)) throw err2
          befreieLocalStorageQuota('fitness')
          window.localStorage.setItem(key, value)
        }
      }
    },
    removeItem: (key) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}

/**
 * Auth-Session in IndexedDB — getrennt von localStorage.
 *
 * Whoop/Portfolio füllen localStorage (~5 MB). Lag die Supabase-Session dort,
 * konnte der Refresh-Token nicht mehr geschrieben werden → Login „vergessen“.
 * IndexedDB hat ein viel größeres Quota und kollidiert nicht mit Fitness-Caches.
 */

import type { SupportedStorage } from '@supabase/supabase-js'

const DB_NAME = 'omnia-auth'
const DB_VERSION = 1
const STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('idb open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const v = req.result
      resolve(typeof v === 'string' ? v : v == null ? null : String(v))
    }
  })
}

function idbSet(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(value, key)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbDel(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(key)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Migriert bestehende localStorage-Session (sb-*-auth-*) einmalig nach IndexedDB. */
async function migriereAusLocalStorage(db: IDBDatabase): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith('sb-') && k.includes('auth')) keys.push(k)
    }
    for (const k of keys) {
      const existing = await idbGet(db, k)
      if (existing) continue
      const v = window.localStorage.getItem(k)
      if (v) {
        await idbSet(db, k, v)
        // In LS lassen als Fallback, bis IDB sich bewährt — Quota-Schutz löscht Auth dort nicht mehr
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Supabase SupportedStorage (async). Session überlebt volle localStorage-Quota.
 */
export function createSupabaseAuthIdbStorage(): SupportedStorage {
  let dbPromise: Promise<IDBDatabase> | null = null
  const memory = new Map<string, string>()

  const db = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = openDb()
        .then(async (database) => {
          await migriereAusLocalStorage(database)
          return database
        })
        .catch((err) => {
          dbPromise = null
          throw err
        })
    }
    return dbPromise
  }

  return {
    getItem: async (key) => {
      if (memory.has(key)) return memory.get(key)!
      try {
        const database = await db()
        const v = await idbGet(database, key)
        if (v != null) {
          memory.set(key, v)
          return v
        }
        // Fallback: alte Session noch nur in localStorage
        if (typeof window !== 'undefined') {
          const ls = window.localStorage.getItem(key)
          if (ls) {
            memory.set(key, ls)
            void idbSet(database, key, ls)
            return ls
          }
        }
        return null
      } catch {
        try {
          return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
        } catch {
          return null
        }
      }
    },
    setItem: async (key, value) => {
      memory.set(key, value)
      try {
        const database = await db()
        await idbSet(database, key, value)
      } catch {
        // Notfall: localStorage (mit Quota-Schutz von außen)
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
        } catch {
          /* ignore */
        }
      }
      // Spiegel klein halten — Auth-Key auch in LS, falls IDB später blockiert (Privatmodus)
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
      } catch {
        /* Quota: IDB hat den Wert schon — ok */
      }
    },
    removeItem: async (key) => {
      memory.delete(key)
      try {
        const database = await db()
        await idbDel(database, key)
      } catch {
        /* ignore */
      }
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}

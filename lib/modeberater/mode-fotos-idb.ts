import type { ModeFoto, ModePersonFoto } from '@/lib/modeberater/mode-profil'

const DB_NAME = 'omnia-modeberater'
const DB_VERSION = 1
const STORE = 'fotos'
const BUNDLE_KEY = 'bundle'

export type ModeFotoBundle = {
  person: ModePersonFoto[]
  kleidung: Record<string, ModeFoto>
}

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function ladeModeFotoBundle(): Promise<ModeFotoBundle | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(BUNDLE_KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const v = req.result as ModeFotoBundle | undefined
        if (!v || typeof v !== 'object') {
          resolve(null)
          return
        }
        resolve({
          person: Array.isArray(v.person) ? v.person : [],
          kleidung: v.kleidung && typeof v.kleidung === 'object' ? v.kleidung : {},
        })
      }
    })
  } catch {
    return null
  }
}

export async function speichereModeFotoBundle(bundle: ModeFotoBundle): Promise<boolean> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(bundle, BUNDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}

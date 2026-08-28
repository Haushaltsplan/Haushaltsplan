/**
 * Geteilter Speicher für manuell „auf die Einkaufsliste gesetzte" Artikel.
 * localStorage + Cloud, damit Laptop und Handy denselben Stand haben.
 */

import {
  EINKAUF_MERKER_EVENT,
  EINKAUF_MERKER_IDS_KEY,
  EINKAUF_MERKER_NAMEN_KEY,
} from '@/lib/client-state/client-state-keys'

const KEY = EINKAUF_MERKER_IDS_KEY
const NAMEN_KEY = EINKAUF_MERKER_NAMEN_KEY
const EVENT = EINKAUF_MERKER_EVENT

function speicher(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function leseJsonArray(key: string): string[] {
  const store = speicher()
  if (!store) return []
  try {
    let raw = store.getItem(key)
    if (!raw) {
      try {
        raw = sessionStorage.getItem(key)
        if (raw) store.setItem(key, raw)
      } catch {
        /* ignore */
      }
    }
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function lese(): Set<string> {
  return new Set(leseJsonArray(KEY))
}

function leseNamen(): Set<string> {
  return new Set(leseJsonArray(NAMEN_KEY))
}

function pushEinkaufCloud() {
  void import('@/lib/client-state/client-state-local').then(({ leseEinkaufslisteLokal }) => {
    void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
      pushClientState('einkaufsliste', leseEinkaufslisteLokal())
    })
  })
}

function schreibeNamen(set: Set<string>) {
  const store = speicher()
  if (!store) return
  try {
    store.setItem(NAMEN_KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent(EVENT))
    pushEinkaufCloud()
  } catch {
    /* ignore */
  }
}

function schreibe(set: Set<string>) {
  const store = speicher()
  if (!store) return
  try {
    store.setItem(KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent(EVENT))
    pushEinkaufCloud()
  } catch {
    /* ignore */
  }
}

export function gemerkteIds(): string[] {
  return [...lese()]
}

export function istGemerkt(id: string): boolean {
  return lese().has(id)
}

export function gemerkteNamen(): string[] {
  return [...leseNamen()]
}

export function merkeNameFuerEinkauf(name: string): void {
  const n = name.trim()
  if (!n) return
  const s = leseNamen()
  s.add(n)
  schreibeNamen(s)
}

export function entferneNamensMerker(name: string): void {
  const s = leseNamen()
  if (s.delete(name.trim())) schreibeNamen(s)
}

export function merkeFuerEinkauf(id: string): void {
  const s = lese()
  s.add(id)
  schreibe(s)
}

export function entferneMerker(id: string): void {
  const s = lese()
  if (s.delete(id)) schreibe(s)
}

export function toggleMerker(id: string): boolean {
  const s = lese()
  let nun: boolean
  if (s.has(id)) {
    s.delete(id)
    nun = false
  } else {
    s.add(id)
    nun = true
  }
  schreibe(s)
  return nun
}

/** Abonniert Änderungen (andere Komponenten, Tabs, Cloud-Apply). */
export function abonniereMerker(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => cb()
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

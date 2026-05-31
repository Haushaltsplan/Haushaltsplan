/**
 * Kleiner geteilter Speicher für manuell „auf die Einkaufsliste gesetzte" Artikel.
 * Entkoppelt Übersicht/Bestandsliste (setzen) von der Einkaufsliste (anzeigen)
 * über sessionStorage + ein window-Event, ohne globalen State-Container.
 */

const KEY = 'mein-haushalt:einkauf-merker-v1'
const NAMEN_KEY = 'mein-haushalt:einkauf-merker-namen-v1'
const EVENT = 'einkauf-merker-geaendert'

function lese(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function leseNamen(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(NAMEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function schreibeNamen(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(NAMEN_KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

function schreibe(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent(EVENT))
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

/** Abonniert Änderungen (auch aus anderen Komponenten/Tabs der gleichen Sitzung). */
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

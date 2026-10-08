import { lesePersonlichenStorage, schreibePersonlichenStorage } from '@/lib/zugriff-client'

export type TitelVergleichEintrag = {
  isin: string | null
  name: string
  symbolYahoo: string | null
}

export type TitelVergleichState = {
  eintraege: TitelVergleichEintrag[]
  referenzKey: string | null
}

export const TITEL_VERGLEICH_STORAGE_KEY = 'pa-titel-vergleich-v1'
export const TITEL_VERGLEICH_CHANGED_EVENT = 'omnia-titel-vergleich-changed'
export const TITEL_VERGLEICH_MAX = 4
export const VERGLEICH_PFAD = '/portfolioanalyse/vergleich'

export function titelVergleichSchluessel(e: TitelVergleichEintrag): string {
  if (e.isin?.trim()) return e.isin.trim().toUpperCase()
  if (e.symbolYahoo?.trim()) return `SYM:${e.symbolYahoo.trim().toUpperCase()}`
  return `NAME:${e.name.trim().toUpperCase()}`
}

function leerState(): TitelVergleichState {
  return { eintraege: [], referenzKey: null }
}

export function ladeTitelVergleich(): TitelVergleichState {
  if (typeof window === 'undefined') return leerState()
  try {
    const raw = lesePersonlichenStorage(TITEL_VERGLEICH_STORAGE_KEY)
    if (!raw) return leerState()
    const j = JSON.parse(raw) as TitelVergleichState
    if (!j || !Array.isArray(j.eintraege)) return leerState()
    const eintraege = j.eintraege
      .filter((e) => e && (e.isin?.trim() || e.symbolYahoo?.trim() || e.name?.trim()))
      .slice(0, TITEL_VERGLEICH_MAX)
      .map((e) => ({
        isin: e.isin?.trim().toUpperCase() || null,
        name: e.name?.trim() || e.symbolYahoo?.trim() || 'Unbekannt',
        symbolYahoo: e.symbolYahoo?.trim() || null,
      }))
    let referenzKey = j.referenzKey?.trim() || null
    if (referenzKey && !eintraege.some((e) => titelVergleichSchluessel(e) === referenzKey)) {
      referenzKey = eintraege[0] ? titelVergleichSchluessel(eintraege[0]) : null
    }
    if (!referenzKey && eintraege[0]) referenzKey = titelVergleichSchluessel(eintraege[0])
    return { eintraege, referenzKey }
  } catch {
    return leerState()
  }
}

export function speichereTitelVergleich(state: TitelVergleichState): void {
  if (typeof window === 'undefined') return
  const eintraege = state.eintraege.slice(0, TITEL_VERGLEICH_MAX)
  let referenzKey = state.referenzKey
  if (referenzKey && !eintraege.some((e) => titelVergleichSchluessel(e) === referenzKey)) {
    referenzKey = eintraege[0] ? titelVergleichSchluessel(eintraege[0]) : null
  }
  try {
    schreibePersonlichenStorage(
      TITEL_VERGLEICH_STORAGE_KEY,
      JSON.stringify({ eintraege, referenzKey } satisfies TitelVergleichState),
    )
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TITEL_VERGLEICH_CHANGED_EVENT))
}

export function fuegeZumTitelVergleichHinzu(eintrag: TitelVergleichEintrag): {
  ok: boolean
  state: TitelVergleichState
  fehler?: string
} {
  const state = ladeTitelVergleich()
  const key = titelVergleichSchluessel(eintrag)
  if (state.eintraege.some((e) => titelVergleichSchluessel(e) === key)) {
    return { ok: true, state }
  }
  if (state.eintraege.length >= TITEL_VERGLEICH_MAX) {
    return {
      ok: false,
      state,
      fehler: `Maximal ${TITEL_VERGLEICH_MAX} Titel im Vergleich.`,
    }
  }
  const next: TitelVergleichState = {
    eintraege: [...state.eintraege, eintrag],
    referenzKey: state.referenzKey ?? key,
  }
  speichereTitelVergleich(next)
  return { ok: true, state: next }
}

export function entferneAusTitelVergleich(key: string): TitelVergleichState {
  const state = ladeTitelVergleich()
  const eintraege = state.eintraege.filter((e) => titelVergleichSchluessel(e) !== key)
  const next: TitelVergleichState = {
    eintraege,
    referenzKey:
      state.referenzKey === key
        ? eintraege[0]
          ? titelVergleichSchluessel(eintraege[0])
          : null
        : state.referenzKey,
  }
  speichereTitelVergleich(next)
  return next
}

export function setzeTitelVergleichReferenz(key: string): TitelVergleichState {
  const state = ladeTitelVergleich()
  if (!state.eintraege.some((e) => titelVergleichSchluessel(e) === key)) return state
  const next = { ...state, referenzKey: key }
  speichereTitelVergleich(next)
  return next
}

export function leereTitelVergleich(): void {
  speichereTitelVergleich(leerState())
}

export function vergleichHref(): string {
  return VERGLEICH_PFAD
}

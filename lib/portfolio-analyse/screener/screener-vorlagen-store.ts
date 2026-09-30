/**
 * Eigene Screener-Vorlagen: lokal sofort, Cloud über omnia_client_state.
 */

import { CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'
import { lesePersonlichenStorage, schreibePersonlichenStorage } from '@/lib/zugriff-client'
import { parseScreenerFilter } from '@/lib/portfolio-analyse/screener/screener-filter'
import type { ScreenerEigeneVorlage, ScreenerFilter } from '@/lib/portfolio-analyse/screener/screener-types'

export const SCREENER_VORLAGEN_STORAGE_KEY = 'pa-screener-vorlagen-v1'
export const SCREENER_VORLAGEN_EVENT = 'pa-screener-vorlagen-geaendert'
export const SCREENER_VORLAGEN_MAX = 30

export type ScreenerVorlagenPayload = {
  vorlagen: ScreenerEigeneVorlage[]
}

function parseSpalten(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const ids = raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
  return ids.length > 0 ? ids : undefined
}

function parseEine(raw: unknown): ScreenerEigeneVorlage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id.trim() : ''
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!id || !name) return null
  return {
    id,
    name: name.slice(0, 80),
    filter: parseScreenerFilter(r.filter),
    spalten: parseSpalten(r.spalten),
    aktualisiertAm: typeof r.aktualisiertAm === 'string' ? r.aktualisiertAm : new Date().toISOString(),
  }
}

export function parseScreenerVorlagenPayload(raw: unknown): ScreenerVorlagenPayload {
  const liste = raw && typeof raw === 'object' && Array.isArray((raw as { vorlagen?: unknown }).vorlagen)
    ? (raw as { vorlagen: unknown[] }).vorlagen
    : Array.isArray(raw)
      ? raw
      : []
  const vorlagen: ScreenerEigeneVorlage[] = []
  const gesehen = new Set<string>()
  for (const row of liste) {
    const v = parseEine(row)
    if (!v || gesehen.has(v.id)) continue
    gesehen.add(v.id)
    vorlagen.push(v)
    if (vorlagen.length >= SCREENER_VORLAGEN_MAX) break
  }
  return { vorlagen }
}

export function leseScreenerVorlagen(): ScreenerEigeneVorlage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = lesePersonlichenStorage(SCREENER_VORLAGEN_STORAGE_KEY)
    if (!raw) return []
    return parseScreenerVorlagenPayload(JSON.parse(raw) as unknown).vorlagen
  } catch {
    return []
  }
}

export function schreibeScreenerVorlagen(vorlagen: ScreenerEigeneVorlage[], opts?: { mitCloud?: boolean }): ScreenerEigeneVorlage[] {
  const gekappt = vorlagen.slice(0, SCREENER_VORLAGEN_MAX)
  if (typeof window === 'undefined') return gekappt
  try {
    schreibePersonlichenStorage(SCREENER_VORLAGEN_STORAGE_KEY, JSON.stringify({ vorlagen: gekappt } satisfies ScreenerVorlagenPayload))
    window.dispatchEvent(new CustomEvent(SCREENER_VORLAGEN_EVENT))
  } catch {
    /* quota */
  }
  if (opts?.mitCloud !== false) {
    void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
      pushClientState(CLIENT_STATE_KEYS.screenerVorlagen, { vorlagen: gekappt }, { debounceMs: 800 })
    })
  }
  return gekappt
}

export type SpeichereVorlageOpts = {
  name: string
  filter: ScreenerFilter
  spalten?: string[]
  id?: string
}

export function speichereScreenerVorlage(opts: SpeichereVorlageOpts): ScreenerEigeneVorlage[] {
  const liste = leseScreenerVorlagen()
  const jetzt = new Date().toISOString()
  const titel = opts.name.trim().slice(0, 80) || 'Unbenannt'
  const spalten = opts.spalten && opts.spalten.length > 0 ? [...opts.spalten] : undefined
  if (opts.id) {
    const idx = liste.findIndex((v) => v.id === opts.id)
    if (idx >= 0) {
      liste[idx] = {
        ...liste[idx]!,
        name: titel,
        filter: opts.filter,
        spalten,
        aktualisiertAm: jetzt,
      }
      return schreibeScreenerVorlagen(liste)
    }
  }
  const neu: ScreenerEigeneVorlage = {
    id: `eigen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: titel,
    filter: opts.filter,
    spalten,
    aktualisiertAm: jetzt,
  }
  return schreibeScreenerVorlagen([neu, ...liste.filter((v) => v.id !== neu.id)])
}

export function benenneScreenerVorlageUm(id: string, name: string): ScreenerEigeneVorlage[] {
  const liste = leseScreenerVorlagen()
  const idx = liste.findIndex((v) => v.id === id)
  if (idx < 0) return liste
  const titel = name.trim().slice(0, 80)
  if (!titel) return liste
  liste[idx] = { ...liste[idx]!, name: titel, aktualisiertAm: new Date().toISOString() }
  return schreibeScreenerVorlagen(liste)
}

export function loescheScreenerVorlage(id: string): ScreenerEigeneVorlage[] {
  return schreibeScreenerVorlagen(leseScreenerVorlagen().filter((v) => v.id !== id))
}

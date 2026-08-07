/**
 * Persistenz für den Führungspfad (localStorage).
 */

import { FUEHRUNG_MANTRA_DEFAULT } from '@/lib/fuehrung/content'

export const FUEHRUNG_STORAGE_KEY = 'omnia-fuehrung-v2'

/** Challenge startet am Tag des Feedback-Gesprächs. */
export const FUEHRUNG_CHALLENGE_START = '2026-08-07'
/** 6 Lernwochen + 1 Pause-Woche (Urlaub). */
export const FUEHRUNG_CHALLENGE_TAGE = 49
export const FUEHRUNG_FOKUS_DEFAULT_MIN = 45

export type FuehrungSituationTyp = 'unterbrechung' | 'abgeschoben' | 'fuehrung' | 'sonstiges'
export type FuehrungReaktion = 'redirect' | 'nein' | 'spaeter' | 'selbst' | 'ausgenutzt'

export type FuehrungTagesEintrag = {
  datum: string
  prinzipIds: string[]
  redirects: number
  neins: number
  win: string
  ausrutscher: string
  notiz: string
  abendCheckErledigt: boolean
}

export type FuehrungNotiz = {
  id: string
  titel: string
  text: string
  createdAt: string
  updatedAt: string
}

export type FuehrungSituation = {
  id: string
  datum: string
  typ: FuehrungSituationTyp
  reaktion: FuehrungReaktion
  personId: string | null
  personName: string
  text: string
  createdAt: string
}

export type FuehrungPerson = {
  id: string
  name: string
  muster: string
  strategie: string
  notiz: string
  createdAt: string
  updatedAt: string
}

export type FuehrungFokusBlock = {
  id: string
  datum: string
  dauerMin: number
  gestartetAt: string
  beendetAt: string
  abgeschlossen: boolean
  notiz: string
}

export type FuehrungAktiverFokus = {
  gestartetAt: string
  dauerMin: number
} | null

export type FuehrungErinnerungen = {
  aktiv: boolean
  morgenStunde: number
  morgenMinute: number
  abendStunde: number
  abendMinute: number
  lastMorgen: string | null
  lastAbend: string | null
}

export type FuehrungSparringEintrag = {
  id: string
  frage: string
  einordnung: string
  einordnungText: string
  saetze: string[]
  tipp: string
  createdAt: string
}

/** Woche-1: Mitarbeiter, die dich mit Fragen holen. */
export type FuehrungMitarbeiter = {
  id: string
  name: string
  createdAt: string
}

/** Einzelne Frage / Unterbrechung eines Mitarbeiters. */
export type FuehrungMitarbeiterFrage = {
  id: string
  mitarbeiterId: string
  datum: string
  /** Was genau wissen / haben sie gewollt */
  thema: string
  createdAt: string
}

export type FuehrungState = {
  mantra: string
  challengeStart: string
  challengeTage: number
  wochenFortschritt: Record<string, number[]>
  tage: Record<string, FuehrungTagesEintrag>
  journal: { id: string; datum: string; text: string; createdAt: string }[]
  notizen: FuehrungNotiz[]
  situationen: FuehrungSituation[]
  personen: FuehrungPerson[]
  fokusBloecke: FuehrungFokusBlock[]
  aktiverFokus: FuehrungAktiverFokus
  erinnerungen: FuehrungErinnerungen
  /** ISO-Wochenkey, für den das Sonntags-Review schon gesehen wurde */
  lastWochenReviewKey: string | null
  sparring: FuehrungSparringEintrag[]
  mitarbeiter: FuehrungMitarbeiter[]
  mitarbeiterFragen: FuehrungMitarbeiterFrage[]
}

export function heuteIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function defaultErinnerungen(): FuehrungErinnerungen {
  return {
    aktiv: false,
    morgenStunde: 8,
    morgenMinute: 0,
    abendStunde: 17,
    abendMinute: 30,
    lastMorgen: null,
    lastAbend: null,
  }
}

export function defaultFuehrungState(): FuehrungState {
  return {
    mantra: FUEHRUNG_MANTRA_DEFAULT,
    challengeStart: FUEHRUNG_CHALLENGE_START,
    challengeTage: FUEHRUNG_CHALLENGE_TAGE,
    wochenFortschritt: {},
    tage: {},
    journal: [],
    notizen: [],
    situationen: [],
    personen: [],
    fokusBloecke: [],
    aktiverFokus: null,
    erinnerungen: defaultErinnerungen(),
    lastWochenReviewKey: null,
    sparring: [],
    mitarbeiter: [],
    mitarbeiterFragen: [],
  }
}

function migrateTag(raw: Partial<FuehrungTagesEintrag> & { datum?: string }): FuehrungTagesEintrag {
  const datum = raw.datum ?? heuteIso()
  return {
    ...leererTag(datum),
    ...raw,
    datum,
    abendCheckErledigt: Boolean(raw.abendCheckErledigt),
  }
}

export function ladeFuehrungState(): FuehrungState {
  if (typeof window === 'undefined') return defaultFuehrungState()
  try {
    const rawV2 = localStorage.getItem(FUEHRUNG_STORAGE_KEY)
    const rawV1 = localStorage.getItem('omnia-fuehrung-v1')
    const raw = rawV2 ?? rawV1
    if (!raw) return defaultFuehrungState()
    const parsed = JSON.parse(raw) as Partial<FuehrungState>
    const base = defaultFuehrungState()
    const tage: Record<string, FuehrungTagesEintrag> = {}
    for (const [k, v] of Object.entries(parsed.tage ?? {})) {
      tage[k] = migrateTag({ ...v, datum: k })
    }
    const challengeTage =
      typeof parsed.challengeTage === 'number' && parsed.challengeTage >= FUEHRUNG_CHALLENGE_TAGE
        ? parsed.challengeTage
        : FUEHRUNG_CHALLENGE_TAGE
    const state: FuehrungState = {
      ...base,
      ...parsed,
      mantra: typeof parsed.mantra === 'string' && parsed.mantra.trim() ? parsed.mantra : base.mantra,
      challengeTage,
      wochenFortschritt: parsed.wochenFortschritt ?? {},
      tage,
      journal: Array.isArray(parsed.journal) ? parsed.journal : [],
      notizen: Array.isArray(parsed.notizen) ? parsed.notizen : [],
      situationen: Array.isArray(parsed.situationen) ? parsed.situationen : [],
      personen: Array.isArray(parsed.personen) ? parsed.personen : [],
      fokusBloecke: Array.isArray(parsed.fokusBloecke) ? parsed.fokusBloecke : [],
      aktiverFokus: parsed.aktiverFokus ?? null,
      erinnerungen: { ...base.erinnerungen, ...(parsed.erinnerungen ?? {}) },
      lastWochenReviewKey: parsed.lastWochenReviewKey ?? null,
      sparring: Array.isArray(parsed.sparring) ? parsed.sparring : [],
      mitarbeiter: Array.isArray(parsed.mitarbeiter) ? parsed.mitarbeiter : [],
      mitarbeiterFragen: Array.isArray(parsed.mitarbeiterFragen) ? parsed.mitarbeiterFragen : [],
    }
    if (!rawV2 && rawV1) speichereFuehrungState(state)
    return state
  } catch {
    return defaultFuehrungState()
  }
}

export function speichereFuehrungState(state: FuehrungState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(FUEHRUNG_STORAGE_KEY, JSON.stringify(state))
}

export function challengeEndeIso(start: string, tage: number): string {
  const d = new Date(`${start}T12:00:00`)
  d.setDate(d.getDate() + tage)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function tageBisEnde(start: string, tage: number, heute = heuteIso()): number {
  const ende = new Date(`${challengeEndeIso(start, tage)}T12:00:00`).getTime()
  const now = new Date(`${heute}T12:00:00`).getTime()
  return Math.ceil((ende - now) / 86400000)
}

export function aktuelleWochenNr(start: string, heute = heuteIso(), maxSlots = 7): number {
  const a = new Date(`${start}T12:00:00`).getTime()
  const b = new Date(`${heute}T12:00:00`).getTime()
  const diff = Math.floor((b - a) / 86400000)
  if (diff < 0) return 1
  return Math.min(maxSlots, Math.floor(diff / 7) + 1)
}

export function leererTag(datum: string): FuehrungTagesEintrag {
  return {
    datum,
    prinzipIds: [],
    redirects: 0,
    neins: 0,
    win: '',
    ausrutscher: '',
    notiz: '',
    abendCheckErledigt: false,
  }
}

export function summeMetriken(
  tage: Record<string, FuehrungTagesEintrag>,
  situationen: FuehrungSituation[] = [],
): {
  redirects: number
  neins: number
  tageMitEintrag: number
  situationen: number
  ausgenutzt: number
} {
  let redirects = 0
  let neins = 0
  let tageMitEintrag = 0
  for (const t of Object.values(tage)) {
    if (
      t.redirects ||
      t.neins ||
      t.win.trim() ||
      t.ausrutscher.trim() ||
      t.prinzipIds.length ||
      t.abendCheckErledigt
    ) {
      tageMitEintrag++
    }
    redirects += t.redirects || 0
    neins += t.neins || 0
  }
  // Situationen erhöhen die Tageszähler beim Speichern — hier nicht nochmal addieren.
  const ausgenutzt = situationen.filter((s) => s.reaktion === 'ausgenutzt').length
  return { redirects, neins, tageMitEintrag, situationen: situationen.length, ausgenutzt }
}

export function tagHatAbendCheckStoff(t: FuehrungTagesEintrag): boolean {
  return (
    t.prinzipIds.length > 0 ||
    t.redirects > 0 ||
    t.neins > 0 ||
    Boolean(t.win.trim()) ||
    Boolean(t.ausrutscher.trim()) ||
    Boolean(t.notiz.trim())
  )
}

/** Nach 16:00 lokal und noch kein Abend-Check → Erinnerung sinnvoll. */
export function abendCheckOffen(state: FuehrungState, jetzt = new Date()): boolean {
  const heute = heuteIso()
  const tag = state.tage[heute]
  if (tag?.abendCheckErledigt) return false
  if (jetzt.getHours() < 16) return false
  return true
}

export function fokusRestSekunden(aktiver: NonNullable<FuehrungAktiverFokus>, jetzt = Date.now()): number {
  const start = new Date(aktiver.gestartetAt).getTime()
  const ende = start + aktiver.dauerMin * 60_000
  return Math.max(0, Math.ceil((ende - jetzt) / 1000))
}

export function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function fragenFuerMitarbeiterAmTag(
  fragen: FuehrungMitarbeiterFrage[],
  mitarbeiterId: string,
  datum: string,
): FuehrungMitarbeiterFrage[] {
  return fragen.filter((f) => f.mitarbeiterId === mitarbeiterId && f.datum === datum)
}

export function mitarbeiterFragenStats(
  mitarbeiter: FuehrungMitarbeiter[],
  fragen: FuehrungMitarbeiterFrage[],
  vonIso: string,
  bisIso: string,
): { id: string; name: string; anzahl: number }[] {
  return mitarbeiter
    .map((m) => ({
      id: m.id,
      name: m.name,
      anzahl: fragen.filter(
        (f) => f.mitarbeiterId === m.id && f.datum >= vonIso && f.datum <= bisIso,
      ).length,
    }))
    .sort((a, b) => b.anzahl - a.anzahl)
}

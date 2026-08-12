/**
 * Persistenz für den Führungspfad (localStorage + Cloud-Sync).
 */

import { FUEHRUNG_MANTRA_DEFAULT } from '@/lib/fuehrung/content'

export const FUEHRUNG_STORAGE_KEY = 'omnia-fuehrung-v2'

/** Lernwoche 1 startet Montag, 10.08.2026. */
export const FUEHRUNG_CHALLENGE_START = '2026-08-10'
/** Ältere lokale Saves mit Feedback-Datum → auf Lernwochen-Start ziehen. */
const FUEHRUNG_CHALLENGE_START_ALT = ['2026-08-07'] as const
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

/** Tagesstand pro Mitarbeiter: wichtig vs. unnötig + Notizen. */
export type FuehrungMitarbeiterTag = {
  mitarbeiterId: string
  datum: string
  /** Wirklich wichtig — brauchte dich / Führung */
  anzahlWichtig: number
  /** Unnötig — hätte ohne dich gelöst werden können */
  anzahlUnnoetig: number
  notizenWichtig: string
  notizenUnnoetig: string
  updatedAt: string
}

export function tagFragenGesamt(t: Pick<FuehrungMitarbeiterTag, 'anzahlWichtig' | 'anzahlUnnoetig'>): number {
  return t.anzahlWichtig + t.anzahlUnnoetig
}

function normalizeMitarbeiterTag(raw: Partial<FuehrungMitarbeiterTag> & {
  anzahl?: number
  notizen?: string
}): FuehrungMitarbeiterTag {
  const hasSplit =
    raw.anzahlWichtig != null ||
    raw.anzahlUnnoetig != null ||
    typeof raw.notizenWichtig === 'string' ||
    typeof raw.notizenUnnoetig === 'string'
  const anzahlWichtig = hasSplit
    ? Math.max(0, Math.round(Number(raw.anzahlWichtig) || 0))
    : Math.max(0, Math.round(Number(raw.anzahl) || 0))
  const anzahlUnnoetig = hasSplit ? Math.max(0, Math.round(Number(raw.anzahlUnnoetig) || 0)) : 0
  const notizenWichtig = hasSplit
    ? typeof raw.notizenWichtig === 'string'
      ? raw.notizenWichtig
      : ''
    : typeof raw.notizen === 'string'
      ? raw.notizen
      : ''
  const notizenUnnoetig = hasSplit
    ? typeof raw.notizenUnnoetig === 'string'
      ? raw.notizenUnnoetig
      : ''
    : ''
  return {
    mitarbeiterId: String(raw.mitarbeiterId ?? ''),
    datum: String(raw.datum ?? ''),
    anzahlWichtig,
    anzahlUnnoetig,
    notizenWichtig,
    notizenUnnoetig,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

/** @deprecated Altformat — wird beim Laden migriert. */
export type FuehrungMitarbeiterFrage = {
  id: string
  mitarbeiterId: string
  datum: string
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
  mitarbeiterTage: FuehrungMitarbeiterTag[]
  /** Letzte lokale/Cloud-Änderung (ISO) — für Sync Last-Write-Wins */
  aktualisiertAm?: string
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
    mitarbeiterTage: [],
  }
}

function migrateMitarbeiterTage(parsed: Partial<FuehrungState> & { mitarbeiterFragen?: FuehrungMitarbeiterFrage[] }): FuehrungMitarbeiterTag[] {
  if (Array.isArray(parsed.mitarbeiterTage) && parsed.mitarbeiterTage.length > 0) {
    return parsed.mitarbeiterTage.map((t) =>
      normalizeMitarbeiterTag(t as Partial<FuehrungMitarbeiterTag> & { anzahl?: number; notizen?: string }),
    )
  }
  const alt = Array.isArray(parsed.mitarbeiterFragen) ? parsed.mitarbeiterFragen : []
  if (alt.length === 0) return []
  const map = new Map<string, FuehrungMitarbeiterTag>()
  for (const f of alt) {
    const key = `${f.mitarbeiterId}|${f.datum}`
    const cur = map.get(key) ?? {
      mitarbeiterId: f.mitarbeiterId,
      datum: f.datum,
      anzahlWichtig: 0,
      anzahlUnnoetig: 0,
      notizenWichtig: '',
      notizenUnnoetig: '',
      updatedAt: f.createdAt || new Date().toISOString(),
    }
    // Altformat ohne Einordnung → erstmal unter „wichtig“, damit nichts verloren geht
    cur.anzahlWichtig += 1
    const line = (f.thema || '').trim()
    if (line) {
      cur.notizenWichtig = cur.notizenWichtig ? `${cur.notizenWichtig}\n· ${line}` : `· ${line}`
    }
    map.set(key, cur)
  }
  return [...map.values()]
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

/** Normalisiert Roh-JSON (localStorage oder Cloud) zu einem gültigen State. */
export function parseFuehrungState(raw: unknown): FuehrungState {
  const base = defaultFuehrungState()
  if (!raw || typeof raw !== 'object') return base
  const parsed = raw as Partial<FuehrungState> & { mitarbeiterFragen?: FuehrungMitarbeiterFrage[] }
  const tage: Record<string, FuehrungTagesEintrag> = {}
  for (const [k, v] of Object.entries(parsed.tage ?? {})) {
    tage[k] = migrateTag({ ...v, datum: k })
  }
  const challengeTage =
    typeof parsed.challengeTage === 'number' && parsed.challengeTage >= FUEHRUNG_CHALLENGE_TAGE
      ? parsed.challengeTage
      : FUEHRUNG_CHALLENGE_TAGE
  const challengeStartRaw =
    typeof parsed.challengeStart === 'string' && parsed.challengeStart.trim()
      ? parsed.challengeStart.trim()
      : FUEHRUNG_CHALLENGE_START
  const challengeStart = (FUEHRUNG_CHALLENGE_START_ALT as readonly string[]).includes(
    challengeStartRaw,
  )
    ? FUEHRUNG_CHALLENGE_START
    : challengeStartRaw
  return {
    ...base,
    ...parsed,
    mantra: typeof parsed.mantra === 'string' && parsed.mantra.trim() ? parsed.mantra : base.mantra,
    challengeStart,
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
    mitarbeiterTage: migrateMitarbeiterTage(parsed),
    aktualisiertAm:
      typeof parsed.aktualisiertAm === 'string' && parsed.aktualisiertAm.trim()
        ? parsed.aktualisiertAm.trim()
        : undefined,
  }
}

export function ladeFuehrungState(): FuehrungState {
  if (typeof window === 'undefined') return defaultFuehrungState()
  try {
    const rawV2 = localStorage.getItem(FUEHRUNG_STORAGE_KEY)
    const rawV1 = localStorage.getItem('omnia-fuehrung-v1')
    const raw = rawV2 ?? rawV1
    if (!raw) return defaultFuehrungState()
    const state = parseFuehrungState(JSON.parse(raw))
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

export function mitarbeiterTagAm(
  tage: FuehrungMitarbeiterTag[],
  mitarbeiterId: string,
  datum: string,
): FuehrungMitarbeiterTag | null {
  return tage.find((t) => t.mitarbeiterId === mitarbeiterId && t.datum === datum) ?? null
}

export function summeMitarbeiterFragenAmTag(tage: FuehrungMitarbeiterTag[], datum: string): number {
  return tage.filter((t) => t.datum === datum).reduce((s, t) => s + tagFragenGesamt(t), 0)
}

export function summeMitarbeiterFragenSplit(
  tage: FuehrungMitarbeiterTag[],
  vonIso: string,
  bisIso: string,
): { gesamt: number; wichtig: number; unnoetig: number } {
  let wichtig = 0
  let unnoetig = 0
  for (const t of tage) {
    if (t.datum < vonIso || t.datum > bisIso) continue
    wichtig += t.anzahlWichtig
    unnoetig += t.anzahlUnnoetig
  }
  return { gesamt: wichtig + unnoetig, wichtig, unnoetig }
}

export function mitarbeiterFragenStats(
  mitarbeiter: FuehrungMitarbeiter[],
  tage: FuehrungMitarbeiterTag[],
  vonIso: string,
  bisIso: string,
): { id: string; name: string; anzahl: number; anzahlWichtig: number; anzahlUnnoetig: number }[] {
  return mitarbeiter
    .map((m) => {
      const rows = tage.filter(
        (t) => t.mitarbeiterId === m.id && t.datum >= vonIso && t.datum <= bisIso,
      )
      const anzahlWichtig = rows.reduce((s, t) => s + t.anzahlWichtig, 0)
      const anzahlUnnoetig = rows.reduce((s, t) => s + t.anzahlUnnoetig, 0)
      return {
        id: m.id,
        name: m.name,
        anzahlWichtig,
        anzahlUnnoetig,
        anzahl: anzahlWichtig + anzahlUnnoetig,
      }
    })
    .sort((a, b) => b.anzahl - a.anzahl)
}

export type FuehrungMitarbeiterTagPatch = {
  anzahlWichtig?: number
  anzahlUnnoetig?: number
  notizenWichtig?: string
  notizenUnnoetig?: string
}

function tagIstLeer(t: FuehrungMitarbeiterTag): boolean {
  return (
    tagFragenGesamt(t) === 0 &&
    !t.notizenWichtig.trim() &&
    !t.notizenUnnoetig.trim()
  )
}

export function upsertMitarbeiterTag(
  tage: FuehrungMitarbeiterTag[],
  mitarbeiterId: string,
  datum: string,
  patch: FuehrungMitarbeiterTagPatch,
): FuehrungMitarbeiterTag[] {
  const now = new Date().toISOString()
  const idx = tage.findIndex((t) => t.mitarbeiterId === mitarbeiterId && t.datum === datum)
  if (idx < 0) {
    const next = normalizeMitarbeiterTag({
      mitarbeiterId,
      datum,
      anzahlWichtig: patch.anzahlWichtig ?? 0,
      anzahlUnnoetig: patch.anzahlUnnoetig ?? 0,
      notizenWichtig: patch.notizenWichtig ?? '',
      notizenUnnoetig: patch.notizenUnnoetig ?? '',
      updatedAt: now,
    })
    if (tagIstLeer(next)) return tage
    return [next, ...tage]
  }
  const cur = tage[idx]
  const next: FuehrungMitarbeiterTag = {
    ...cur,
    anzahlWichtig:
      patch.anzahlWichtig != null
        ? Math.max(0, Math.round(patch.anzahlWichtig))
        : cur.anzahlWichtig,
    anzahlUnnoetig:
      patch.anzahlUnnoetig != null
        ? Math.max(0, Math.round(patch.anzahlUnnoetig))
        : cur.anzahlUnnoetig,
    notizenWichtig: patch.notizenWichtig != null ? patch.notizenWichtig : cur.notizenWichtig,
    notizenUnnoetig: patch.notizenUnnoetig != null ? patch.notizenUnnoetig : cur.notizenUnnoetig,
    updatedAt: now,
  }
  if (tagIstLeer(next)) {
    return tage.filter((_, i) => i !== idx)
  }
  const copy = [...tage]
  copy[idx] = next
  return copy
}

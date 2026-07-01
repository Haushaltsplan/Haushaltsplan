/** Tägliches Verhaltens-Logbuch (Schlaf-Hygiene). */

import {
  isoAddDays,
  kannTagVor,
  kannTagZurueck,
  labelTagNavigation,
  ladeDailyStore,
  speichereDailyStore,
  type WhoopDailyStore,
} from '@/lib/fitnessdaten/daily-records'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'

export type LogbuchFrageId =
  | 'essen_vor_schlaf'
  | 'bett_lesen'
  | 'alkohol'
  | 'abendsnack'
  | 'koffein'

export type LogbuchAntwort = {
  ja: boolean
  wann?: string | null
  menge?: string | null
}

export type LogbuchTagRecord = {
  date: string
  antworten: Partial<Record<LogbuchFrageId, LogbuchAntwort>>
  updatedAt: string
}

export type LogbuchFrageDef = {
  id: LogbuchFrageId
  frage: string
  wannLabel: string
  mengeLabel: string
  wannPlaceholder: string
  mengePlaceholder: string
}

export const LOGBUCH_FRAGEN: LogbuchFrageDef[] = [
  {
    id: 'essen_vor_schlaf',
    frage: 'Kurz vor dem Schlafengehen noch etwas gegessen?',
    wannLabel: 'Wann?',
    mengeLabel: 'Was / wie viel?',
    wannPlaceholder: 'z. B. 22:30',
    mengePlaceholder: 'z. B. Joghurt, halbe Pizza',
  },
  {
    id: 'bett_lesen',
    frage: 'Im Bett gelesen?',
    wannLabel: 'Wann / wie lange?',
    mengeLabel: 'Was / Umfang?',
    wannPlaceholder: 'z. B. 23:00, 20 Min',
    mengePlaceholder: 'z. B. Buch, Handy',
  },
  {
    id: 'alkohol',
    frage: 'Alkohol konsumiert?',
    wannLabel: 'Wann?',
    mengeLabel: 'Wie viel?',
    wannPlaceholder: 'z. B. ab 19:00',
    mengePlaceholder: 'z. B. 2 Bier, 1 Glas Wein',
  },
  {
    id: 'abendsnack',
    frage: 'Hast du einen Abendsnack gegessen?',
    wannLabel: 'Wann?',
    mengeLabel: 'Was / wie viel?',
    wannPlaceholder: 'z. B. 21:00',
    mengePlaceholder: 'z. B. Nüsse, Schokolade',
  },
  {
    id: 'koffein',
    frage: 'Koffein konsumiert?',
    wannLabel: 'Wann?',
    mengeLabel: 'Wie viel?',
    wannPlaceholder: 'z. B. 15:30',
    mengePlaceholder: 'z. B. 1 Espresso, 2 Tassen Tee',
  },
]

export { labelTagNavigation, isoAddDays, kannTagVor, kannTagZurueck, heuteIsoLocal }

export function leeresLogbuchTag(date: string): LogbuchTagRecord {
  return { date, antworten: {}, updatedAt: new Date().toISOString() }
}

export function ladeLogbuchTag(date: string, store = ladeDailyStore()): LogbuchTagRecord {
  const hit = store.logbuch?.find((t) => t.date === date)
  return hit ? { ...hit, antworten: { ...hit.antworten } } : leeresLogbuchTag(date)
}

export function speichereLogbuchAntwort(
  date: string,
  frageId: LogbuchFrageId,
  antwort: LogbuchAntwort,
): LogbuchTagRecord {
  const store = ladeDailyStore()
  if (!store.logbuch) store.logbuch = []
  const idx = store.logbuch.findIndex((t) => t.date === date)
  const basis = idx >= 0 ? store.logbuch[idx]! : leeresLogbuchTag(date)
  const record: LogbuchTagRecord = {
    date,
    antworten: { ...basis.antworten, [frageId]: antwort },
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) store.logbuch[idx] = record
  else store.logbuch.push(record)
  store.logbuch.sort((a, b) => b.date.localeCompare(a.date))
  if (store.logbuch.length > 400) store.logbuch = store.logbuch.slice(0, 400)
  syncLogbuchInJournal(record, store)
  speichereDailyStore(store)
  return record
}

export function antwortVollstaendig(a: LogbuchAntwort | undefined): boolean {
  if (!a) return false
  if (!a.ja) return true
  return Boolean(a.wann?.trim() && a.menge?.trim())
}

export function logbuchTagVollstaendig(record: LogbuchTagRecord): boolean {
  return LOGBUCH_FRAGEN.every((f) => antwortVollstaendig(record.antworten[f.id]))
}

export function logbuchTagHatEintrag(record: LogbuchTagRecord): boolean {
  return Object.keys(record.antworten).length > 0
}

export function logbuchDatumMitEintrag(store = ladeDailyStore()): Set<string> {
  return new Set((store.logbuch ?? []).filter((t) => logbuchTagHatEintrag(t)).map((t) => t.date))
}

export function formatLogbuchAntwortKurz(a: LogbuchAntwort | undefined): string {
  if (!a) return '—'
  if (!a.ja) return 'Nein'
  const w = a.wann?.trim()
  const m = a.menge?.trim()
  if (w && m) return `Ja · ${w} · ${m}`
  if (w) return `Ja · ${w}`
  if (m) return `Ja · ${m}`
  return 'Ja'
}

/** Sync in Whoop-Journal (Lesbarkeit / Export-Kompatibilität). */
export function syncLogbuchInJournal(record: LogbuchTagRecord, store: WhoopDailyStore): void {
  for (const def of LOGBUCH_FRAGEN) {
    const a = record.antworten[def.id]
    if (!a) continue
    const answer = formatLogbuchAntwortKurz(a)
    const existing = store.journal.findIndex((j) => j.date === record.date && j.question === def.frage)
    const entry = { date: record.date, question: def.frage, answer }
    if (existing >= 0) store.journal[existing] = entry
    else store.journal.push(entry)
  }
  store.journal.sort((a, b) => b.date.localeCompare(a.date))
}

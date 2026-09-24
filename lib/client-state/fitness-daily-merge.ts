/**
 * Merge für WHOOP-Tagesarchive: pro Tag/ID das vollständigere bzw. neuere gewinnt.
 * Verhindert, dass BLE-Daten vom Handy Cloud-Tage vom Laptop überschreiben (und umgekehrt).
 */
import type { WhoopActivity, WhoopDailyStore, WhoopDayRecord, WhoopJournalEntry } from '@/lib/fitnessdaten/daily-records'
import { aktivitaetDatum } from '@/lib/fitnessdaten/daily-records'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import type { LogbuchTagRecord } from '@/lib/fitnessdaten/logbuch'

function nichtLeer(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

function mergeDay(a: WhoopDayRecord, b: WhoopDayRecord): WhoopDayRecord {
  const out: WhoopDayRecord = { ...a }

  // Schritte/Kalorien: Cloud-Provenance gewinnt immer gegen Schätzung
  if (b.stepsFromCloud && b.steps != null) {
    out.steps = b.steps
    out.stepsFromCloud = true
  } else if (a.stepsFromCloud && a.steps != null) {
    out.steps = a.steps
    out.stepsFromCloud = true
  } else {
    out.steps = a.steps ?? b.steps ?? null
    out.stepsFromCloud = Boolean(a.stepsFromCloud || b.stepsFromCloud)
  }

  if (b.caloriesFromCloud && b.calories != null) {
    out.calories = b.calories
    out.caloriesFromCloud = true
  } else if (a.caloriesFromCloud && a.calories != null) {
    out.calories = a.calories
    out.caloriesFromCloud = true
  } else {
    out.calories = a.calories ?? b.calories ?? null
    out.caloriesFromCloud = Boolean(a.caloriesFromCloud || b.caloriesFromCloud)
  }

  const skip = new Set<keyof WhoopDayRecord>([
    'steps',
    'calories',
    'stepsFromCloud',
    'caloriesFromCloud',
  ])
  const keys = Object.keys(b) as (keyof WhoopDayRecord)[]
  for (const k of keys) {
    if (skip.has(k)) continue
    const bv = b[k]
    const av = out[k]
    if (!nichtLeer(av) && nichtLeer(bv)) {
      ;(out as Record<string, unknown>)[k] = bv
    } else if (k === 'recoveryLocked' || k === 'bffMetrics' || k === 'strainFromCloud') {
      ;(out as Record<string, unknown>)[k] = Boolean(av) || Boolean(bv)
    }
  }
  return out
}

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>()
  for (const x of a) if (x?.id) map.set(x.id, x)
  for (const x of b) if (x?.id) map.set(x.id, x)
  return [...map.values()]
}

function mergeLogbuch(a: LogbuchTagRecord[], b: LogbuchTagRecord[]): LogbuchTagRecord[] {
  const map = new Map<string, LogbuchTagRecord>()
  for (const x of [...a, ...b]) {
    if (!x?.date) continue
    const cur = map.get(x.date)
    if (!cur || (x.updatedAt || '') >= (cur.updatedAt || '')) map.set(x.date, x)
  }
  return [...map.values()]
}

function mergeJournal(a: WhoopJournalEntry[], b: WhoopJournalEntry[]): WhoopJournalEntry[] {
  const map = new Map<string, WhoopJournalEntry>()
  for (const x of [...a, ...b]) {
    if (!x?.date) continue
    const k = `${x.date}|${x.question}`
    if (!map.has(k)) map.set(k, x)
  }
  return [...map.values()]
}

export function mergeFitnessDailyStores(lokal: WhoopDailyStore, cloud: WhoopDailyStore): WhoopDailyStore {
  const days = new Map<string, WhoopDayRecord>()
  for (const d of [...(lokal.days ?? []), ...(cloud.days ?? [])]) {
    if (!d?.date) continue
    const cur = days.get(d.date)
    days.set(d.date, cur ? mergeDay(cur, d) : d)
  }
  const heute = heuteIsoLocal()
  const activitiesToday = mergeById(lokal.activitiesToday ?? [], cloud.activitiesToday ?? []).filter(
    (a: WhoopActivity) => aktivitaetDatum(a) === heute,
  )
  return {
    version: 2,
    days: [...days.values()].sort((x, y) => x.date.localeCompare(y.date)),
    activitiesToday,
    activities: mergeById(lokal.activities ?? [], cloud.activities ?? []),
    journal: mergeJournal(lokal.journal ?? [], cloud.journal ?? []),
    logbuch: mergeLogbuch(lokal.logbuch ?? [], cloud.logbuch ?? []),
    vitals: mergeById(lokal.vitals ?? [], cloud.vitals ?? []),
    skinTempBaseline: lokal.skinTempBaseline ?? cloud.skinTempBaseline ?? null,
    bffMonthlyAvgs: lokal.bffMonthlyAvgs ?? cloud.bffMonthlyAvgs ?? null,
  }
}

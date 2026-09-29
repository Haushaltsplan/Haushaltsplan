/**
 * WHOOP-Datenimport: offizieller App-Export (CSV/ZIP) + Omnia-JSON-Backup.
 */

import { unzipSync, strFromU8 } from 'fflate'
import {
  ladeDailyStore,
  speichereDailyStore,
  createEmptyDayRecord,
  type WhoopActivity,
  type WhoopDayRecord,
  type WhoopJournalEntry,
} from '@/lib/fitnessdaten/daily-records'
import {
  ladeFitnessHistory,
  ladeFitnessSnapshot,
  speichereFitnessHistory,
  speichereFitnessSnapshot,
} from '@/lib/fitnessdaten/history-storage'
import { heuteIsoKalender, isoAusMs } from '@/lib/fitnessdaten/iso-date'
import { loadAusStrain } from '@/lib/fitnessdaten/strain-engine'
import type { FitnessHistoryState, FitnessSnapshot, HrZoneMinutes } from '@/lib/fitnessdaten/types'
import { ladeFitnessProfil, speichereFitnessProfil, type FitnessUserProfile } from '@/lib/fitnessdaten/user-profile'
import { ladeSyncState, speichereSyncState, type SyncState } from '@/lib/fitnessdaten/offline-sync'

export type WhoopImportErgebnis = {
  ok: boolean
  tageImportiert: number
  tageNeu: number
  tageAktualisiert: number
  aeltestesDatum: string | null
  neuestesDatum: string | null
  quellen: string[]
  hinweise: string[]
  fehler: string[]
}

/** Liest CSV-Dateien und/oder Whoop-ZIP-Export (entpackt CSVs mit fflate). */
export async function leseWhoopImportDateien(
  files: FileList | File[],
): Promise<{ name: string; text: string }[]> {
  const list = Array.from(files)
  const out: { name: string; text: string }[] = []

  for (const f of list) {
    const lower = f.name.toLowerCase()
    if (lower.endsWith('.zip')) {
      try {
        const buf = new Uint8Array(await f.arrayBuffer())
        const unzipped = unzipSync(buf)
        for (const [path, data] of Object.entries(unzipped)) {
          const base = path.split(/[/\\]/).pop() ?? path
          if (!base.toLowerCase().endsWith('.csv')) continue
          if (path.includes('__MACOSX')) continue
          out.push({ name: base, text: strFromU8(data) })
        }
      } catch (e) {
        throw new Error(
          `ZIP konnte nicht gelesen werden (${f.name}): ${e instanceof Error ? e.message : 'unbekannt'}`,
        )
      }
      continue
    }
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      out.push({ name: f.name, text: await f.text() })
    }
  }

  return out
}

export type OmniaFitnessExport = {
  version: 1
  exportedAt: string
  profile: FitnessUserProfile
  history: FitnessHistoryState
  daily: ReturnType<typeof ladeDailyStore>
  snapshot: FitnessSnapshot | null
  sync: SyncState
}

type TagMap = Map<string, Partial<WhoopDayRecord>>

export function parseWhoopCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { headers: [], rows: [] }

  let start = 0
  const first = lines[0]!.trim()
  if (!first.includes(';') && !first.includes(',') && lines.length > 2) start = 1

  const headerLine = lines[start]!
  const delim = headerLine.includes(';') ? ';' : ','
  const headers = parseCsvLine(headerLine, delim)
  const rows: Record<string, string>[] = []

  for (let i = start + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!, delim)
    if (cols.every((c) => !c.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim() ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === delim && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function zahl(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const t = raw.trim().replace(/%$/, '').trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Erst exakte Spalte, dann Teiltreffer — sonst greift z. B. „strain“ die „Activity Strain“-Spalte. */
function rohAusZeile(row: Record<string, string>, keys: string[]): string | null {
  const spalten = Object.entries(row).map(([h, v]) => [normKey(h), v?.trim() ?? ''] as const)
  for (const k of keys) {
    for (const [nk, v] of spalten) if (nk === k && v) return v
  }
  for (const k of keys) {
    for (const [nk, v] of spalten) if (nk.includes(k) && v) return v
  }
  return null
}

function zahlAusZeile(row: Record<string, string>, ...keys: string[]): number | null {
  return zahl(rohAusZeile(row, keys))
}

function textAusZeile(row: Record<string, string>, ...keys: string[]): string | null {
  return rohAusZeile(row, keys)
}

function msAusDatetime(raw: string | null): number | null {
  if (!raw) return null
  const t = Date.parse(raw.trim().replace(' ', 'T'))
  return Number.isFinite(t) ? t : null
}

/**
 * WHOOP-Zyklen beginnen mit dem Einschlafen am Vorabend. Die App zeigt Recovery, Schlaf
 * und Tages-Strain aber am Tag des Aufwachens — daher Wake-Onset bzw. Start + 6 h.
 */
const CYCLE_VORLAUF_MS = 6 * 3600_000

function whoopTagAusZeile(row: Record<string, string>): string | null {
  const wake = msAusDatetime(textAusZeile(row, 'wake_onset'))
  if (wake != null) return isoAusMs(wake)
  const start = msAusDatetime(textAusZeile(row, 'cycle_start_time', 'cycle_start'))
  if (start != null) return isoAusMs(start + CYCLE_VORLAUF_MS)
  return Object.values(row)[0]?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
}

function ohneLeere<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

function minuten(v: number | null): number | null {
  return v != null && v > 0 ? Math.round(v) : null
}

function schlafFelder(row: Record<string, string>): Partial<WhoopDayRecord> {
  const light = zahlAusZeile(row, 'light_sleep_duration', 'light_sleep')
  const deep = zahlAusZeile(row, 'deep_duration', 'deep_sws_duration', 'deep_sleep', 'slow_wave')
  const rem = zahlAusZeile(row, 'rem_duration', 'rem_sleep')
  const awake = zahlAusZeile(row, 'awake_duration')
  const stagesSumme = (light ?? 0) + (deep ?? 0) + (rem ?? 0)
  const asleep =
    zahlAusZeile(row, 'asleep_duration', 'total_sleep_duration', 'time_asleep') ??
    (stagesSumme > 0 ? stagesSumme : null)

  return ohneLeere({
    sleepScore: zahlAusZeile(row, 'sleep_performance'),
    sleepEfficiency: zahlAusZeile(row, 'sleep_efficiency'),
    sleepConsistency: zahlAusZeile(row, 'sleep_consistency'),
    sleepNeedMinutes: minuten(zahlAusZeile(row, 'sleep_need')),
    respiratoryRate: zahlAusZeile(row, 'respiratory_rate'),
    sleepMinutes: minuten(asleep),
    remMinutes: minuten(rem),
    deepMinutes: minuten(deep),
    lightMinutes: minuten(light),
    awakeMinutes: minuten(awake),
    bedTimeMs: msAusDatetime(textAusZeile(row, 'sleep_onset')),
    wakeTimeMs: msAusDatetime(textAusZeile(row, 'wake_onset')),
  })
}

function parsePhysiologicalCycles(rows: Record<string, string>[], map: TagMap): number {
  let n = 0
  for (const row of rows) {
    const date = whoopTagAusZeile(row)
    if (!date) continue
    const kj = zahlAusZeile(row, 'kilojoule', 'energy_kilojoule')
    const calDirect = zahlAusZeile(row, 'energy_burned', 'calories')
    const calories = calDirect != null ? Math.round(calDirect) : kj != null ? Math.round(kj / 4.184) : null
    const felder = ohneLeere({
      recoveryPercent: zahlAusZeile(row, 'recovery_score', 'recovery'),
      strain: zahlAusZeile(row, 'day_strain', 'strain_score', 'strain'),
      hrvRmssd: zahlAusZeile(row, 'heart_rate_variability', 'hrv'),
      restingHr: zahlAusZeile(row, 'resting_heart_rate', 'resting_hr'),
      skinTempC: zahlAusZeile(row, 'skin_temp', 'skin_temperature'),
      spo2Percent: zahlAusZeile(row, 'blood_oxygen', 'spo2'),
      avgHr: zahlAusZeile(row, 'average_hr', 'average_heart_rate', 'avg_hr', 'avg_heart_rate'),
      maxHr: zahlAusZeile(row, 'max_hr', 'max_heart_rate'),
      calories: calories != null && calories > 0 ? calories : null,
      steps: zahlAusZeile(row, 'steps', 'step_count', 'daily_steps'),
    })
    map.set(date, { ...map.get(date), ...schlafFelder(row), ...felder, date })
    n++
  }
  return n
}

function parseSleeps(rows: Record<string, string>[], map: TagMap): number {
  let n = 0
  for (const row of rows) {
    if (textAusZeile(row, 'nap')?.toUpperCase() === 'TRUE') continue
    const date = whoopTagAusZeile(row)
    if (!date) continue
    const felder = schlafFelder(row)
    const prev = map.get(date)
    // Mehrere Nicht-Nap-Schläfe am selben Tag: der längere ist der Hauptschlaf.
    if (prev?.sleepMinutes != null && (felder.sleepMinutes ?? 0) < prev.sleepMinutes) continue
    map.set(date, { ...prev, ...felder, date })
    n++
  }
  return n
}

function parseWorkouts(
  rows: Record<string, string>[],
  map: TagMap,
  calByDay: Map<string, number>,
): WhoopActivity[] {
  const zonenByDay = new Map<string, HrZoneMinutes>()
  const activities: WhoopActivity[] = []
  for (const row of rows) {
    const startMs = msAusDatetime(textAusZeile(row, 'workout_start_time', 'workout_start'))
    const date = startMs != null ? isoAusMs(startMs) : whoopTagAusZeile(row)
    if (!date) continue
    const start = startMs ?? Date.parse(`${date}T12:00:00`)
    const endMs = msAusDatetime(textAusZeile(row, 'workout_end_time', 'workout_end')) ?? start + 3600_000
    const dauerMin = zahlAusZeile(row, 'duration') ?? Math.max(0, (endMs - start) / 60_000)

    const cal = zahlAusZeile(row, 'energy_burned', 'calories')
    if (cal != null) calByDay.set(date, (calByDay.get(date) ?? 0) + cal)

    const zonen = zonenByDay.get(date) ?? { rest: 0, z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
    let zonenGefunden = false
    for (const z of [1, 2, 3, 4, 5] as const) {
      const pct = zahlAusZeile(row, `hr_zone_${z}`)
      if (pct == null) continue
      zonenGefunden = true
      zonen[`z${z}`] += Math.round((dauerMin * pct) / 100)
    }
    if (zonenGefunden) zonenByDay.set(date, zonen)

    const sport = textAusZeile(row, 'activity_name', 'sport', 'workout_activity_name') ?? 'Workout'
    activities.push({
      id: `csv-${date}-${start}-${sport}`,
      label: sport,
      strain: zahlAusZeile(row, 'activity_strain', 'workout_strain', 'strain') ?? 0,
      startMs: start,
      endMs,
      date,
      sport,
      avgHr: zahlAusZeile(row, 'average_hr', 'average_heart_rate', 'avg_hr', 'avg_heart_rate'),
      maxHr: zahlAusZeile(row, 'max_hr', 'max_heart_rate'),
      calories: cal != null ? Math.round(cal) : null,
    })
  }
  for (const [date, z] of zonenByDay) {
    const prev = map.get(date) ?? { date }
    map.set(date, {
      ...prev,
      date,
      zoneMinutes: z,
      zoneMin13: z.z1 + z.z2 + z.z3,
      zoneMin45: z.z4 + z.z5,
    })
  }
  return activities
}

function journalAntwort(ja: string | null, notiz: string | null): string {
  const j = ja?.trim().toLowerCase()
  const basis = j === 'true' ? 'Ja' : j === 'false' ? 'Nein' : (ja?.trim() ?? '')
  const n = notiz?.trim()
  if (basis && n) return `${basis} — ${n}`
  return basis || n || ''
}

function parseJournal(rows: Record<string, string>[]): WhoopJournalEntry[] {
  const entries: WhoopJournalEntry[] = []
  if (rows.length === 0) return entries
  const headers = Object.keys(rows[0] ?? {})
  const strukturiert = headers.some((h) => normKey(h).includes('question_text'))

  if (strukturiert) {
    for (const row of rows) {
      const date = whoopTagAusZeile(row)
      const question = textAusZeile(row, 'question_text')
      if (!date || !question) continue
      const answer = journalAntwort(textAusZeile(row, 'answered_yes'), textAusZeile(row, 'notes'))
      if (!answer) continue
      entries.push({ date, question, answer })
    }
    return entries
  }

  const metaSpalte = (h: string) => /^cycle_(start|end)|timezone/.test(normKey(h))
  for (const row of rows) {
    const date = whoopTagAusZeile(row)
    if (!date) continue
    for (const [header, val] of Object.entries(row)) {
      if (metaSpalte(header) || !val?.trim()) continue
      entries.push({ date, question: header.trim(), answer: val.trim() })
    }
  }
  return entries
}

function erkenneCsvTyp(name: string, headers: string[]): string {
  const n = name.toLowerCase()
  if (n.includes('physiological') || n.includes('cycles')) return 'cycles'
  if (n.includes('journal')) return 'journal'
  if (n.includes('sleep')) return 'sleeps'
  if (n.includes('workout')) return 'workouts'
  const h = headers.map(normKey).join(' ')
  if (h.includes('recovery') && h.includes('strain')) return 'cycles'
  if (h.includes('question_text') || h.includes('journal')) return 'journal'
  if (h.includes('workout_start')) return 'workouts'
  if (h.includes('sleep_onset')) return 'sleeps'
  return 'unknown'
}

export function parseWhoopCsvDatei(
  name: string,
  text: string,
): {
  map: TagMap
  typ: string
  zeilen: number
  activities: WhoopActivity[]
  journal: WhoopJournalEntry[]
  /** Workout-Kalorien je Tag — nur für Tage ohne Zyklus-Kalorien. */
  workoutKalorien: Map<string, number>
} {
  const { headers, rows } = parseWhoopCsv(text)
  const typ = erkenneCsvTyp(name, headers)
  const map: TagMap = new Map()
  const workoutKalorien = new Map<string, number>()
  let activities: WhoopActivity[] = []
  let journal: WhoopJournalEntry[] = []

  if (typ === 'cycles') parsePhysiologicalCycles(rows, map)
  else if (typ === 'sleeps') parseSleeps(rows, map)
  else if (typ === 'workouts') activities = parseWorkouts(rows, map, workoutKalorien)
  else if (typ === 'journal') journal = parseJournal(rows)
  else if (rows.length > 0) {
    parsePhysiologicalCycles(rows, map)
    if (map.size === 0) parseSleeps(rows, map)
  }

  return { map, typ, zeilen: rows.length, activities, journal, workoutKalorien }
}

function leeresTag(date: string): WhoopDayRecord {
  return createEmptyDayRecord(date)
}

/**
 * Importierte Tage bleiben echte WHOOP-Werte: keine Phasen-Schätzung aus Verhältnissen und
 * keine Bettzeit der laufenden BLE-Nacht (ergaenzeSchlafDetails ist nur für „heute“ gedacht).
 */
function mapZuRecords(map: TagMap): WhoopDayRecord[] {
  const heute = heuteIsoKalender()
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, partial]) => {
      const base: WhoopDayRecord = { ...leeresTag(date), ...partial, date }
      if (date >= heute) return base
      if (base.steps != null && base.steps > 0) base.stepsFromCloud = true
      if (base.calories != null && base.calories > 0) base.caloriesFromCloud = true
      if (base.strain != null) base.strainFromCloud = true
      if (base.recoveryPercent != null) base.recoveryLocked = true
      return base
    })
}

const MERGE_FLAGS = new Set<keyof WhoopDayRecord>([
  'stepsFromCloud',
  'caloriesFromCloud',
  'strainFromCloud',
  'recoveryLocked',
])

function mergeTag(a: WhoopDayRecord, b: WhoopDayRecord): WhoopDayRecord {
  const out: WhoopDayRecord = { ...a }
  for (const [k, v] of Object.entries(b) as [keyof WhoopDayRecord, unknown][]) {
    if (k === 'date' || v == null) continue
    if (MERGE_FLAGS.has(k)) {
      ;(out as Record<string, unknown>)[k] = Boolean(a[k]) || Boolean(v)
      continue
    }
    if (typeof v === 'number' && v === 0) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

function mergeRecords(existing: WhoopDayRecord[], imported: WhoopDayRecord[]) {
  const byDate = new Map<string, WhoopDayRecord>()
  for (const d of existing) byDate.set(d.date, d)
  let neu = 0
  let aktualisiert = 0
  for (const imp of imported) {
    const prev = byDate.get(imp.date)
    if (!prev) {
      byDate.set(imp.date, imp)
      neu++
    } else {
      byDate.set(imp.date, mergeTag(prev, imp))
      aktualisiert++
    }
  }
  return {
    merged: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    neu,
    aktualisiert,
  }
}

function historyAusImport(days: WhoopDayRecord[]): FitnessHistoryState {
  const history = ladeFitnessHistory()
  for (const d of days) {
    const t = new Date(`${d.date}T07:30:00`).getTime()
    if (d.hrvRmssd != null && d.hrvRmssd > 0) history.hrvSamples.push({ t, rmssd: d.hrvRmssd })
    if (d.restingHr != null && d.restingHr > 0) history.rhrSamples.push({ t, bpm: d.restingHr })
  }
  history.hrvSamples = history.hrvSamples.slice(-200)
  history.rhrSamples = history.rhrSamples.slice(-100)

  const last30 = days.slice(-30)
  const hrvs = last30.map((d) => d.hrvRmssd).filter((v): v is number => v != null && v > 0)
  const rhrs = last30.map((d) => d.restingHr).filter((v): v is number => v != null && v > 0)
  if (hrvs.length > 0) {
    history.baselines.hrvRmssdMs =
      Math.round((hrvs.reduce((a, b) => a + b, 0) / hrvs.length) * 10) / 10
  }
  if (rhrs.length > 0) {
    history.baselines.restingHrBpm = Math.round(rhrs.reduce((a, b) => a + b, 0) / rhrs.length)
  }

  const heute = days[days.length - 1]
  if (heute?.strain != null) {
    history.dayStrain = heute.strain
    history.dayStrainDate = heute.date
    history.strainScore = heute.strain
    history.strainLoad = loadAusStrain(heute.strain)
    history.lastStrainTick = Date.now()
  }
  if (heute?.calories != null) history.caloriesToday = heute.calories
  return history
}

export function importiereWhoopCsvDateien(dateien: { name: string; text: string }[]): WhoopImportErgebnis {
  const hinweise: string[] = []
  const fehler: string[] = []
  const quellen: string[] = []
  const gesamtMap: TagMap = new Map()
  const allActivities: WhoopActivity[] = []
  const allJournal: WhoopJournalEntry[] = []
  const workoutKalorienGesamt = new Map<string, number>()

  for (const f of dateien) {
    try {
      const { map, typ, zeilen, activities, journal, workoutKalorien } = parseWhoopCsvDatei(f.name, f.text)
      for (const [date, cal] of workoutKalorien) {
        workoutKalorienGesamt.set(date, (workoutKalorienGesamt.get(date) ?? 0) + cal)
      }
      if (zeilen === 0) {
        fehler.push(`${f.name}: keine Datenzeilen`)
        continue
      }
      if (typ === 'unknown' && map.size === 0 && journal.length === 0) {
        fehler.push(`${f.name}: Format nicht erkannt`)
        continue
      }
      quellen.push(`${f.name} (${typ}, ${zeilen} Zeilen)`)
      for (const [date, partial] of map) {
        gesamtMap.set(date, { ...gesamtMap.get(date), ...partial, date })
      }
      allActivities.push(...activities)
      allJournal.push(...journal)
    } catch (e) {
      fehler.push(`${f.name}: ${e instanceof Error ? e.message : 'Fehler'}`)
    }
  }

  for (const [date, cal] of workoutKalorienGesamt) {
    const prev = gesamtMap.get(date)
    if (prev?.calories == null && cal > 0) gesamtMap.set(date, { ...prev, date, calories: Math.round(cal) })
  }

  if (gesamtMap.size === 0 && allJournal.length === 0) {
    return {
      ok: false,
      tageImportiert: 0,
      tageNeu: 0,
      tageAktualisiert: 0,
      aeltestesDatum: null,
      neuestesDatum: null,
      quellen,
      hinweise,
      fehler: fehler.length ? fehler : ['Keine Tagesdaten gefunden.'],
    }
  }

  const imported = mapZuRecords(gesamtMap)
  const store = ladeDailyStore()
  const { merged, neu, aktualisiert } = mergeRecords(store.days, imported)
  store.days = merged
  if (allActivities.length > 0) {
    const byId = new Map(store.activities.map((a) => [a.id, a]))
    for (const a of allActivities) byId.set(a.id, a)
    store.activities = [...byId.values()].sort((a, b) => a.startMs - b.startMs).slice(-500)
  }
  if (allJournal.length > 0) {
    const key = (j: WhoopJournalEntry) => `${j.date}|${j.question}|${j.answer}`
    const seen = new Set(store.journal.map(key))
    for (const j of allJournal) {
      const k = key(j)
      if (!seen.has(k)) {
        store.journal.push(j)
        seen.add(k)
      }
    }
    store.journal.sort((a, b) => b.date.localeCompare(a.date))
    if (store.journal.length > 1000) store.journal = store.journal.slice(0, 1000)
  }
  speichereDailyStore(store)
  speichereFitnessHistory(historyAusImport(merged))

  const sync = ladeSyncState()
  sync.lastSyncedAt = new Date().toISOString()
  sync.message = `WHOOP-Import: ${imported.length} Tage`
  speichereSyncState(sync)

  hinweise.push(
    'Der WHOOP-Export enthält keine Schritte und HF-Zonen nur für Workouts — diese Felder bleiben für importierte Tage leer bzw. workoutbasiert.',
  )

  return {
    ok: true,
    tageImportiert: imported.length,
    tageNeu: neu,
    tageAktualisiert: aktualisiert,
    aeltestesDatum: imported[0]?.date ?? null,
    neuestesDatum: imported[imported.length - 1]?.date ?? null,
    quellen,
    hinweise,
    fehler,
  }
}

export function importiereOmniaJson(text: string): WhoopImportErgebnis {
  try {
    const parsed = JSON.parse(text) as OmniaFitnessExport
    if (parsed.version !== 1) {
      return {
        ok: false,
        tageImportiert: 0,
        tageNeu: 0,
        tageAktualisiert: 0,
        aeltestesDatum: null,
        neuestesDatum: null,
        quellen: [],
        hinweise: [],
        fehler: ['Unbekannte Export-Version.'],
      }
    }
    speichereFitnessHistory(parsed.history)
    speichereDailyStore(parsed.daily)
    if (parsed.snapshot) speichereFitnessSnapshot(parsed.snapshot)
    if (parsed.sync) speichereSyncState(parsed.sync)
    if (parsed.profile) speichereFitnessProfil(parsed.profile)
    const days = parsed.daily?.days ?? []
    return {
      ok: true,
      tageImportiert: days.length,
      tageNeu: days.length,
      tageAktualisiert: 0,
      aeltestesDatum: days[0]?.date ?? null,
      neuestesDatum: days[days.length - 1]?.date ?? null,
      quellen: ['Omnia JSON-Backup'],
      hinweise: ['Omnia-Backup wiederhergestellt.'],
      fehler: [],
    }
  } catch (e) {
    return {
      ok: false,
      tageImportiert: 0,
      tageNeu: 0,
      tageAktualisiert: 0,
      aeltestesDatum: null,
      neuestesDatum: null,
      quellen: [],
      hinweise: [],
      fehler: [e instanceof Error ? e.message : 'Ungültiges JSON'],
    }
  }
}

export function exportiereOmniaJson(): string {
  const payload: OmniaFitnessExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: ladeFitnessProfil(),
    history: ladeFitnessHistory(),
    daily: ladeDailyStore(),
    snapshot: ladeFitnessSnapshot(),
    sync: ladeSyncState(),
  }
  return JSON.stringify(payload, null, 2)
}

export function downloadText(dateiname: string, inhalt: string, mime = 'application/json'): void {
  const blob = new Blob([inhalt], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  a.click()
  URL.revokeObjectURL(url)
}

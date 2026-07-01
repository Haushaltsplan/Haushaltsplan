/**
 * WHOOP-Datenimport: offizieller App-Export (CSV) + Omnia-JSON-Backup.
 */

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
import { ergaenzeSchlafDetails } from '@/lib/fitnessdaten/sleep-detail'
import { loadAusStrain } from '@/lib/fitnessdaten/strain-engine'
import type { FitnessHistoryState, FitnessSnapshot } from '@/lib/fitnessdaten/types'
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

function zahl(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function zahlAusZeile(row: Record<string, string>, ...keys: string[]): number | null {
  for (const k of keys) {
    for (const [header, val] of Object.entries(row)) {
      const nk = normKey(header)
      if (nk === k || nk.includes(k)) {
        const n = zahl(val)
        if (n != null) return n
      }
    }
  }
  return null
}

function textAusZeile(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    for (const [header, val] of Object.entries(row)) {
      const nk = normKey(header)
      if (nk === k || nk.includes(k)) {
        const t = val?.trim()
        if (t) return t
      }
    }
  }
  return null
}

function datumAusCycleStart(row: Record<string, string>): string | null {
  const raw = textAusZeile(row, 'cycle_start_time', 'cycle_start') ?? Object.values(row)[0]
  if (!raw) return null
  return raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
}

function msAusDatetime(raw: string | null): number | null {
  if (!raw) return null
  const t = Date.parse(raw.replace(' ', 'T'))
  return Number.isFinite(t) ? t : null
}

function parsePhysiologicalCycles(rows: Record<string, string>[], map: TagMap): number {
  let n = 0
  for (const row of rows) {
    const date = datumAusCycleStart(row)
    if (!date) continue
    const prev = map.get(date) ?? { date }
    const kj = zahlAusZeile(row, 'kilojoule', 'energy_kilojoule')
    const calDirect = zahlAusZeile(row, 'energy_burned', 'calories')
    map.set(date, {
      ...prev,
      date,
      recoveryPercent: zahlAusZeile(row, 'recovery_score', 'recovery') ?? prev.recoveryPercent ?? null,
      strain: zahlAusZeile(row, 'day_strain', 'strain_score', 'strain') ?? prev.strain ?? null,
      hrvRmssd: zahlAusZeile(row, 'heart_rate_variability', 'hrv') ?? prev.hrvRmssd ?? null,
      restingHr: zahlAusZeile(row, 'resting_heart_rate', 'resting_hr') ?? prev.restingHr ?? null,
      respiratoryRate: zahlAusZeile(row, 'respiratory_rate') ?? prev.respiratoryRate ?? null,
      skinTempC: zahlAusZeile(row, 'skin_temp', 'skin_temperature') ?? prev.skinTempC ?? null,
      avgHr: zahlAusZeile(row, 'average_heart_rate', 'avg_heart_rate') ?? prev.avgHr ?? null,
      calories:
        calDirect != null
          ? Math.round(calDirect)
          : kj != null
            ? Math.round(kj / 4.184)
            : prev.calories ?? null,
      steps: zahlAusZeile(row, 'steps', 'step_count', 'daily_steps') ?? prev.steps ?? null,
      maxHr: zahlAusZeile(row, 'max_heart_rate', 'max_hr') ?? prev.maxHr ?? null,
    })
    n++
  }
  return n
}

function parseSleeps(rows: Record<string, string>[], map: TagMap): number {
  let n = 0
  for (const row of rows) {
    if (textAusZeile(row, 'nap')?.toUpperCase() === 'TRUE') continue
    const date = datumAusCycleStart(row)
    if (!date) continue

    const light = zahlAusZeile(row, 'light_sleep_duration', 'light_sleep') ?? 0
    const deep = zahlAusZeile(row, 'deep_sws_duration', 'slow_wave', 'deep') ?? 0
    const rem = zahlAusZeile(row, 'rem_duration', 'rem_sleep') ?? 0
    const awake = zahlAusZeile(row, 'awake_duration', 'awake') ?? 0
    const total = zahlAusZeile(row, 'total_sleep_duration', 'time_asleep') ?? light + deep + rem

    const prev = map.get(date) ?? { date }
    map.set(date, {
      ...prev,
      date,
      sleepScore: zahlAusZeile(row, 'sleep_performance') ?? prev.sleepScore ?? null,
      sleepEfficiency: zahlAusZeile(row, 'sleep_efficiency') ?? prev.sleepEfficiency ?? null,
      sleepConsistency: zahlAusZeile(row, 'sleep_consistency') ?? prev.sleepConsistency ?? null,
      respiratoryRate: zahlAusZeile(row, 'respiratory_rate') ?? prev.respiratoryRate ?? null,
      sleepMinutes: total > 0 ? Math.round(total) : prev.sleepMinutes ?? null,
      remMinutes: rem > 0 ? Math.round(rem) : prev.remMinutes ?? null,
      deepMinutes: deep > 0 ? Math.round(deep) : prev.deepMinutes ?? null,
      lightMinutes: light > 0 ? Math.round(light) : prev.lightMinutes ?? null,
      awakeMinutes: awake > 0 ? Math.round(awake) : prev.awakeMinutes ?? null,
      bedTimeMs: msAusDatetime(textAusZeile(row, 'sleep_onset')) ?? prev.bedTimeMs ?? null,
      wakeTimeMs: msAusDatetime(textAusZeile(row, 'wake_onset')) ?? prev.wakeTimeMs ?? null,
    })
    n++
  }
  return n
}

function parseWorkouts(rows: Record<string, string>[], map: TagMap): WhoopActivity[] {
  const calByDay = new Map<string, number>()
  const activities: WhoopActivity[] = []
  for (const row of rows) {
    const date =
      datumAusCycleStart(row) ??
      textAusZeile(row, 'workout_start_time', 'workout_start')?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ??
      null
    if (!date) continue
    const cal = zahlAusZeile(row, 'energy_burned', 'calories')
    if (cal != null) calByDay.set(date, (calByDay.get(date) ?? 0) + cal)

    const startRaw = textAusZeile(row, 'workout_start_time', 'workout_start')
    const endRaw = textAusZeile(row, 'workout_end_time', 'workout_end')
    const startMs = startRaw ? Date.parse(startRaw.replace(' ', 'T')) : Date.parse(`${date}T12:00:00`)
    const endMs = endRaw ? Date.parse(endRaw.replace(' ', 'T')) : startMs + 3600_000
    const sport = textAusZeile(row, 'activity_name', 'sport', 'workout_activity_name') ?? 'Workout'
    const strain = zahlAusZeile(row, 'activity_strain', 'workout_strain', 'strain') ?? 0
    activities.push({
      id: `csv-${date}-${startMs}-${sport}`,
      label: sport,
      strain,
      startMs,
      endMs,
      date,
      sport,
      avgHr: zahlAusZeile(row, 'average_heart_rate', 'avg_heart_rate'),
      maxHr: zahlAusZeile(row, 'max_heart_rate', 'max_hr'),
      calories: cal != null ? Math.round(cal) : null,
    })
  }
  for (const [date, cal] of calByDay) {
    const prev = map.get(date) ?? { date }
    if (prev.calories == null) map.set(date, { ...prev, date, calories: Math.round(cal) })
  }
  return activities
}

function parseJournal(rows: Record<string, string>[]): WhoopJournalEntry[] {
  const entries: WhoopJournalEntry[] = []
  if (rows.length === 0) return entries
  const headers = Object.keys(rows[0] ?? {})
  const dateHeader =
    headers.find((h) => normKey(h).includes('cycle_start')) ?? headers[0] ?? 'Cycle start time'

  for (const row of rows) {
    const dateRaw = row[dateHeader] ?? Object.values(row)[0]
    const date = dateRaw?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
    if (!date) continue
    for (const [header, val] of Object.entries(row)) {
      if (header === dateHeader || !val?.trim()) continue
      entries.push({ date, question: header.trim(), answer: val.trim() })
    }
  }
  return entries
}

function erkenneCsvTyp(name: string, headers: string[]): string {
  const n = name.toLowerCase()
  if (n.includes('physiological') || n.includes('cycles')) return 'cycles'
  if (n.includes('sleep')) return 'sleeps'
  if (n.includes('workout')) return 'workouts'
  if (n.includes('journal')) return 'journal'
  const h = headers.map(normKey).join(' ')
  if (h.includes('recovery') && h.includes('strain')) return 'cycles'
  if (h.includes('sleep_onset')) return 'sleeps'
  if (h.includes('workout_start')) return 'workouts'
  if (h.includes('journal') || h.includes('question')) return 'journal'
  return 'unknown'
}

export function parseWhoopCsvDatei(
  name: string,
  text: string,
): { map: TagMap; typ: string; zeilen: number; activities: WhoopActivity[]; journal: WhoopJournalEntry[] } {
  const { headers, rows } = parseWhoopCsv(text)
  const typ = erkenneCsvTyp(name, headers)
  const map: TagMap = new Map()
  let activities: WhoopActivity[] = []
  let journal: WhoopJournalEntry[] = []

  if (typ === 'cycles') parsePhysiologicalCycles(rows, map)
  else if (typ === 'sleeps') parseSleeps(rows, map)
  else if (typ === 'workouts') activities = parseWorkouts(rows, map)
  else if (typ === 'journal') journal = parseJournal(rows)
  else if (rows.length > 0) {
    parsePhysiologicalCycles(rows, map)
    if (map.size === 0) parseSleeps(rows, map)
  }

  return { map, typ, zeilen: rows.length, activities, journal }
}

function leeresTag(date: string): WhoopDayRecord {
  return createEmptyDayRecord(date)
}

function mapZuRecords(map: TagMap): WhoopDayRecord[] {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, partial]) => {
      const base = { ...leeresTag(date), ...partial, date }
      return ergaenzeSchlafDetails(base, base.strain)
    })
}

function mergeTag(a: WhoopDayRecord, b: WhoopDayRecord): WhoopDayRecord {
  const pick = <K extends keyof WhoopDayRecord>(k: K): WhoopDayRecord[K] =>
    (b[k] != null && b[k] !== 0 ? b[k] : a[k]) as WhoopDayRecord[K]
  return ergaenzeSchlafDetails(
    {
      ...a,
      recoveryPercent: pick('recoveryPercent'),
      strain: pick('strain'),
      sleepScore: pick('sleepScore'),
      sleepMinutes: pick('sleepMinutes'),
      sleepEfficiency: pick('sleepEfficiency'),
      sleepConsistency: pick('sleepConsistency'),
      hrvRmssd: pick('hrvRmssd'),
      restingHr: pick('restingHr'),
      respiratoryRate: pick('respiratoryRate'),
      avgHr: pick('avgHr'),
      skinTempC: pick('skinTempC'),
      spo2Percent: pick('spo2Percent'),
      calories: pick('calories'),
      steps: pick('steps'),
      maxHr: pick('maxHr'),
      remMinutes: pick('remMinutes'),
      deepMinutes: pick('deepMinutes'),
      lightMinutes: pick('lightMinutes'),
      awakeMinutes: pick('awakeMinutes'),
      bedTimeMs: pick('bedTimeMs'),
      wakeTimeMs: pick('wakeTimeMs'),
    },
    pick('strain'),
  )
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
    merged: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-365),
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

  for (const f of dateien) {
    try {
      const { map, typ, zeilen, activities, journal } = parseWhoopCsvDatei(f.name, f.text)
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

  hinweise.push('Schritte/HF-Zonen fehlen oft im WHOOP-Export — BLE-IMU oder Strain-Schätzung ergänzt.')

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

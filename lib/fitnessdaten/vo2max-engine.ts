/**
 * VO₂ Max — wöchentliche Aktualisierung (WHOOP-ähnlich).
 * Nutzt 21–30 Tage Recovery, Workout-Max-HF und demografische Daten — keine Tages-Schwankungen.
 */

import {
  createEmptyDayRecord,
  ladeDailyStore,
  speichereDailyStore,
  type WhoopDayRecord,
} from '@/lib/fitnessdaten/daily-records'
import {
  ladeFitnessProfil,
  profilAlter,
  profilGewichtKg,
  profilMaennlich,
  profilMaxHr,
  speichereFitnessProfil,
} from '@/lib/fitnessdaten/user-profile'

export const WHOOP_VO2_TRENDS_KEY = 'mein-haushalt:whoop-vo2-trends'

export type Vo2TrendsStore = {
  version: 1
  /** Aktueller Wochenwert (ml/kg/min). */
  vo2Max: number | null
  /** ISO-Woche der letzten Berechnung (z. B. 2026-W23). */
  woche: string | null
  berechnetAm: string | null
  /** Wöchentliche Historie für Verlaufs-Charts. */
  historie: { woche: string; wert: number }[]
  /** Optional: Laborwert aus WHOOP-App manuell. */
  manuell: number | null
}

const MIN_RECOVERY_TAGE = 14
const FENSTER_TAGE = 30

function defaultStore(): Vo2TrendsStore {
  return { version: 1, vo2Max: null, woche: null, berechnetAm: null, historie: [], manuell: null }
}

export function ladeVo2Trends(): Vo2TrendsStore {
  if (typeof window === 'undefined') return defaultStore()
  try {
    const raw = window.localStorage.getItem(WHOOP_VO2_TRENDS_KEY)
    if (!raw) return defaultStore()
    const p = JSON.parse(raw) as Vo2TrendsStore
    return p.version === 1 ? { ...defaultStore(), ...p } : defaultStore()
  } catch {
    return defaultStore()
  }
}

export function speichereVo2Trends(store: Vo2TrendsStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WHOOP_VO2_TRENDS_KEY, JSON.stringify({ ...store, version: 1 }))
}

export function setzeVo2MaxManuell(wert: number | null): Vo2TrendsStore {
  const s = ladeVo2Trends()
  s.manuell = wert != null && wert >= 20 && wert <= 90 ? Math.round(wert) : null
  if (s.manuell != null) s.vo2Max = s.manuell
  speichereVo2Trends(s)
  return s
}

/** ISO-Kalenderwoche (Montag = Wochenstart, WHOOP-ähnlich). */
export function isoKalenderwoche(ref = new Date()): string {
  const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()))
  const tag = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - tag)
  const jahrStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const woche = Math.ceil(((d.getTime() - jahrStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(woche).padStart(2, '0')}`
}

function mittelwert(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function tageMitRecovery(days: WhoopDayRecord[]): WhoopDayRecord[] {
  return days.filter((d) => d.restingHr != null && d.restingHr > 0)
}

function maxHrAusDaten(days: WhoopDayRecord[], profilMax: number): number {
  const store = ladeDailyStore()
  const workoutMax = store.activities
    .map((a) => a.maxHr)
    .filter((v): v is number => v != null && v > 0)
  const tagesMax = days.map((d) => d.maxHr).filter((v): v is number => v != null && v > 0)
  const peak = Math.max(0, ...workoutMax, ...tagesMax, profilMax)
  return peak > 0 ? peak : profilMax
}

/**
 * WHOOP-nah: Uth (15,3 × MHR/RHR) auf 30-Tage-Baseline-RHR und Workout-Peak-MHR,
 * leicht angehoben durch HFV (WHOOP nutzt HRV + Recovery langfristig).
 */
export function berechneVo2MaxLangfristig(days = ladeDailyStore().days): number | null {
  const fenster = days.slice(-FENSTER_TAGE)
  const mitRecovery = tageMitRecovery(fenster)
  if (mitRecovery.length < MIN_RECOVERY_TAGE) return null

  const profil = ladeFitnessProfil()
  const alter = profilAlter(profil)
  const gewicht = profilGewichtKg(profil)
  const maennlich = profilMaennlich(profil)
  const profilMhr = profilMaxHr(profil)

  const rhrVals = mitRecovery.map((d) => d.restingHr!)
  const rhrAvg = mittelwert(rhrVals)!
  const rhrMin = Math.min(...rhrVals)
  /** WHOOP nutzt nächtliche Tiefstwerte stärker als Tagesmittel. */
  const rhr30 = Math.round(rhrMin * 0.55 + rhrAvg * 0.45)
  if (rhr30 < 35) return null

  const mhr = maxHrAusDaten(fenster, profilMhr)
  if (mhr <= rhr30) return null

  if (mhr > (profil.maxHrOverride ?? 0) && mhr >= 150 && mhr <= 220) {
    profil.maxHrOverride = mhr
    speichereFitnessProfil(profil)
  }

  let vo2 = 15.3 * (mhr / rhr30)

  const hrv30 = mittelwert(
    fenster.map((d) => d.hrvRmssd).filter((v): v is number => v != null && v > 0),
  )
  if (hrv30 != null) {
    if (hrv30 >= 90) vo2 *= 1.06
    else if (hrv30 >= 75) vo2 *= 1.03
    else if (hrv30 < 45) vo2 *= 0.97
  }

  const strainAvg = mittelwert(
    fenster.map((d) => d.strain).filter((v): v is number => v != null && v > 0),
  )
  if (strainAvg != null && strainAvg >= 10) vo2 *= 1.02

  if (!maennlich) vo2 *= 0.96
  if (alter > 45) vo2 *= 1 - Math.min(0.08, (alter - 45) * 0.004)
  if (gewicht > 0 && gewicht < 72) vo2 *= 1.02

  return Math.round(Math.min(75, Math.max(28, vo2)))
}

/** Nur einmal pro Kalenderwoche neu berechnen (WHOOP: wöchentlich, keine Tageswerte). */
export function aktualisiereVo2MaxWennFaellig(force = false): Vo2TrendsStore {
  const store = ladeVo2Trends()
  if (store.manuell != null && !force) {
    store.vo2Max = store.manuell
    return store
  }

  const aktuelleWoche = isoKalenderwoche()
  if (!force && store.woche === aktuelleWoche && store.vo2Max != null) {
    return store
  }

  const neu = berechneVo2MaxLangfristig()
  if (neu == null) return store

  store.vo2Max = neu
  store.woche = aktuelleWoche
  store.berechnetAm = new Date().toISOString()

  const idx = store.historie.findIndex((h) => h.woche === aktuelleWoche)
  if (idx >= 0) store.historie[idx] = { woche: aktuelleWoche, wert: neu }
  else store.historie.push({ woche: aktuelleWoche, wert: neu })

  store.historie.sort((a, b) => a.woche.localeCompare(b.woche))
  if (store.historie.length > 52) store.historie = store.historie.slice(-52)

  speichereVo2Trends(store)
  spiegeleVo2AufTagesrecords(neu)
  return store
}

/** Wochenwert auf alle Tagesrecords der aktuellen Woche — Charts zeigen stabilen Verlauf. */
function spiegeleVo2AufTagesrecords(vo2: number): void {
  const daily = ladeDailyStore()
  const woche = isoKalenderwoche()
  for (const d of daily.days) {
    if (isoKalenderwoche(new Date(d.date + 'T12:00:00')) === woche) {
      d.vo2Max = vo2
    }
  }
  const heute = new Date().toISOString().slice(0, 10)
  let rec = daily.days.find((d) => d.date === heute)
  if (!rec) {
    rec = createEmptyDayRecord(heute)
    daily.days.push(rec)
  }
  rec.vo2Max = vo2
  speichereDailyStore(daily)
}

export function aktuellesVo2Max(): number | null {
  const s = aktualisiereVo2MaxWennFaellig()
  return s.manuell ?? s.vo2Max
}

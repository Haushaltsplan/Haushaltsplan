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

export type Vo2Quelle = 'cloud' | 'berechnet' | 'manuell'

export type Vo2TrendsStore = {
  version: 1
  /** Bestätigter Wert (Cloud-Sync oder Manuell). NIE Uth-Schätzung. */
  vo2Max: number | null
  /** ISO-Woche der letzten lokalen Berechnung (z. B. 2026-W23). */
  woche: string | null
  berechnetAm: string | null
  /** Wöchentliche Historie für Verlaufs-Charts. */
  historie: { woche: string; wert: number }[]
  /**
   * @deprecated Nicht mehr für Cloud-Werte verwenden — nutze vo2Max + quelle = 'cloud'.
   * Bleibt für Rückwärtskompatibilität.
   */
  manuell: number | null
  /** Herkunft des aktuellen vo2Max-Werts. */
  quelle: Vo2Quelle | null
  /** Lokale Uth-Schätzung — wird im Dashboard NICHT angezeigt, nur für Omnia Age. */
  schaetzung: number | null
}

const MIN_RECOVERY_TAGE = 7
const FENSTER_TAGE = 30

function defaultStore(): Vo2TrendsStore {
  return {
    version: 1,
    vo2Max: null,
    woche: null,
    berechnetAm: null,
    historie: [],
    manuell: null,
    quelle: null,
    schaetzung: null,
  }
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

/** Nur aufrufen wenn Cloud Sync fehlschlägt und Nutzer manuell eingreift. */
export function setzeVo2MaxManuell(wert: number | null): Vo2TrendsStore {
  const s = ladeVo2Trends()
  if (wert != null && wert >= 20 && wert <= 90) {
    s.manuell = Math.round(wert)
    s.vo2Max = s.manuell
    s.quelle = 'manuell'
  } else {
    s.manuell = null
    s.vo2Max = s.schaetzung ?? null
    s.quelle = s.schaetzung != null ? 'berechnet' : null
  }
  speichereVo2Trends(s)
  return s
}

/** Wird von Cloud Sync aufgerufen — setzt Quelle als 'cloud'. */
export function setzeVo2MaxAusCloud(wert: number): void {
  const s = ladeVo2Trends()
  s.vo2Max = Math.round(wert)
  s.quelle = 'cloud'
  s.manuell = null // Cloud-Wert übernimmt Priorität
  speichereVo2Trends(s)
  spiegeleVo2AufTagesrecords(Math.round(wert))
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
 * Profil-Fallback wenn weniger als MIN_RECOVERY_TAGE Tage mit RHR vorhanden.
 */
export function berechneVo2MaxLangfristig(days = ladeDailyStore().days): number | null {
  const fenster = days.slice(-FENSTER_TAGE)
  const mitRecovery = tageMitRecovery(fenster)

  const profil = ladeFitnessProfil()
  const alter = profilAlter(profil)
  const gewicht = profilGewichtKg(profil)
  const maennlich = profilMaennlich(profil)
  const profilMhr = profilMaxHr(profil)

  if (mitRecovery.length < MIN_RECOVERY_TAGE) {
    // Profil-Schätzung wenn noch zu wenig RHR-Daten — einfaches demografisches Modell
    if (profilMhr <= 0) return null
    const defaultRhr = 62 - Math.max(0, (alter - 30) * 0.2)
    if (defaultRhr < 35) return null
    let vo2 = 15.3 * (profilMhr / defaultRhr)
    if (!maennlich) vo2 *= 0.96
    if (alter > 45) vo2 *= 1 - Math.min(0.08, (alter - 45) * 0.004)
    if (gewicht > 0 && gewicht < 72) vo2 *= 1.02
    return Math.round(Math.min(65, Math.max(28, vo2)))
  }

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

/**
 * Aktualisiert die lokale Uth-SCHÄTZUNG (wird nur für Omnia Age genutzt, nie im Dashboard).
 * Schreibt NIEMALS in vo2Max wenn ein Cloud/Manuell-Wert vorhanden.
 */
export function aktualisiereVo2MaxWennFaellig(force = false): Vo2TrendsStore {
  const store = ladeVo2Trends()

  // Cloud- oder Manuell-Wert vorhanden → keine Überschreibung
  if ((store.quelle === 'cloud' || store.quelle === 'manuell') && store.vo2Max != null && !force) {
    return store
  }
  // Legacy: manuell-Feld gesetzt → respektieren
  if (store.manuell != null && !force) {
    if (store.vo2Max == null) {
      store.vo2Max = store.manuell
      store.quelle = 'manuell'
      speichereVo2Trends(store)
    }
    return store
  }

  const aktuelleWoche = isoKalenderwoche()
  if (!force && store.woche === aktuelleWoche && store.schaetzung != null) {
    return store
  }

  const neu = berechneVo2MaxLangfristig()
  if (neu == null) return store

  // Schätzung NUR in schaetzung schreiben — nie in vo2Max
  store.schaetzung = neu
  store.woche = aktuelleWoche
  store.berechnetAm = new Date().toISOString()

  // Nur wenn kein bestätigter Wert existiert: auch vo2Max setzen (für Omnia Age intern)
  if (store.vo2Max == null || store.quelle === 'berechnet') {
    store.vo2Max = neu
    store.quelle = 'berechnet'
  }

  speichereVo2Trends(store)
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

/**
 * Gibt den bestätigten VO2max zurück (cloud oder manuell).
 * Gibt KEINE lokale Schätzung zurück — nur für Dashboard-Anzeige.
 */
export function aktuellesVo2Max(): number | null {
  const s = ladeVo2Trends()
  if (s.quelle === 'cloud' || s.quelle === 'manuell') return s.vo2Max
  if (s.manuell != null) return s.manuell // Legacy
  return null
}

/**
 * Gibt den besten verfügbaren VO2max inkl. Schätzung zurück.
 * Nur für Omnia-Age-Berechnung — NICHT für Dashboard-Anzeige.
 */
export function vo2MaxFuerHealthspan(): number | null {
  const s = aktualisiereVo2MaxWennFaellig()
  return s.manuell ?? s.vo2Max ?? s.schaetzung
}

/** Gibt Quelle des aktuellen VO2max zurück. */
export function vo2MaxQuelle(): Vo2Quelle | null {
  const s = ladeVo2Trends()
  if (s.manuell != null) return 'manuell'
  return s.quelle
}

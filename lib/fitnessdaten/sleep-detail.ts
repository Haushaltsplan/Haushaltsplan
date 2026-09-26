/** Erweiterte Schlaf-Metriken (WHOOP-ähnlich, aus IMU + Tageshistorie + Kalibrierung). */

import { ladeCalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'
import { baseline30, ladeDailyStore, type WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'

export type SleepDetailHeute = {
  sleepNeedMinutes: number
  bedTimeMs: number | null
  wakeTimeMs: number | null
  remMinutes: number
  deepMinutes: number
  consistency: number | null
}

let letzteBettZeit: number | null = null
let letzteWeckZeit: number | null = null
let nachtStartMs: number | null = null

export function registriereSchlafFenster(istSchlaf: boolean, now = Date.now()): void {
  if (istSchlaf) {
    if (nachtStartMs == null) nachtStartMs = now
  } else if (nachtStartMs != null) {
    letzteBettZeit = nachtStartMs
    letzteWeckZeit = now
    nachtStartMs = null
  }
}

/** Whoop-nah: Basis + Strain-Zuschlag + Defizit-Anteil (Parameter fitbar). */
export function berechneSchlafbedarf(strain: number | null, defizitMin: number): number {
  const p = ladeCalibrationParams()
  const basis = p.sleepNeedBaseMin
  const strainZuschlag = strain != null ? Math.round(strain * p.sleepNeedStrainFactor) : 0
  const defizitZuschlag = Math.round(defizitMin * p.sleepNeedDebtFactor)
  return Math.min(660, Math.max(360, basis + strainZuschlag + defizitZuschlag))
}

export function schaetzeRemTief(sleepMinutes: number): {
  rem: number
  deep: number
  light: number
  awake: number
} {
  if (sleepMinutes <= 0) return { rem: 0, deep: 0, light: 0, awake: 0 }
  const p = ladeCalibrationParams()
  const rem = Math.round(sleepMinutes * p.sleepRemRatio)
  const deep = Math.round(sleepMinutes * p.sleepDeepRatio)
  // Rest ≈ Light; kleiner Wachanteil (~5 %) wie typische Whoop-Hypnogramme
  const awake = Math.round(sleepMinutes * 0.05)
  const light = Math.max(0, sleepMinutes - rem - deep - awake)
  return { rem, deep, light, awake }
}

export function berechneKonsistenz(tage: WhoopDayRecord[]): number | null {
  const betten = tage.map((d) => d.bedTimeMs).filter((v): v is number => v != null)
  const wecken = tage.map((d) => d.wakeTimeMs).filter((v): v is number => v != null)
  if (betten.length < 3 || wecken.length < 3) return null

  const std = (vals: number[]) => {
    const mins = vals.map((ms) => {
      const d = new Date(ms)
      return d.getHours() * 60 + d.getMinutes()
    })
    const avg = mins.reduce((a, b) => a + b, 0) / mins.length
    const v = mins.reduce((a, m) => a + (m - avg) ** 2, 0) / mins.length
    return Math.sqrt(v)
  }

  const spread = (std(betten) + std(wecken)) / 2
  return Math.round(Math.max(40, Math.min(100, 100 - spread * 1.2)))
}

/**
 * Ergänzt lokale Schlaf-Schatten. Cloud-Stages/Need werden nicht überschrieben,
 * wenn schon gesetzt (Dual-Lauf).
 */
export function ergaenzeSchlafDetails(
  record: WhoopDayRecord,
  strain: number | null,
): WhoopDayRecord {
  const defizit = Math.max(0, 480 - (record.sleepMinutes ?? record.localSleepMinutes ?? 0))
  const localNeed = berechneSchlafbedarf(strain, defizit)
  const sleepMin = record.localSleepMinutes ?? record.sleepMinutes ?? 0
  const { rem, deep, light, awake } = schaetzeRemTief(sleepMin)

  if (letzteBettZeit && !record.bedTimeMs) record.bedTimeMs = letzteBettZeit
  if (letzteWeckZeit && !record.wakeTimeMs) record.wakeTimeMs = letzteWeckZeit

  record.localSleepNeedMinutes = localNeed
  if (record.sleepNeedMinutes == null) record.sleepNeedMinutes = localNeed

  record.localRemMinutes = rem
  record.localDeepMinutes = deep
  record.localLightMinutes = light
  record.localAwakeMinutes = awake
  // Cloud-Stages behalten; lokal nur füllen wenn leer
  if (record.remMinutes == null) record.remMinutes = rem
  if (record.deepMinutes == null) record.deepMinutes = deep
  if (record.lightMinutes == null) record.lightMinutes = light
  if (record.awakeMinutes == null) record.awakeMinutes = awake

  const woche = ladeDailyStore().days.slice(-7)
  const kons = berechneKonsistenz(woche)
  if (kons != null) {
    record.localSleepConsistency = kons
    if (record.sleepConsistency == null) record.sleepConsistency = kons
  }

  return record
}

export function formatUhrzeitKurz(ms: number | null): string {
  if (ms == null) return '—'
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function formatStundenMin(min: number | null): string {
  if (min == null || min <= 0) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function schlafleistungProzent(geschlafen: number | null, bedarf: number | null): number | null {
  if (geschlafen == null || bedarf == null || bedarf <= 0) return null
  return Math.round(Math.min(100, (geschlafen / bedarf) * 100))
}

export function ladeSchlafDetailHeute(): SleepDetailHeute {
  const heute = heuteIsoLocal()
  const rec = ladeDailyStore().days.find((d) => d.date === heute)
  return {
    sleepNeedMinutes: rec?.sleepNeedMinutes ?? 480,
    bedTimeMs: rec?.bedTimeMs ?? null,
    wakeTimeMs: rec?.wakeTimeMs ?? null,
    remMinutes: rec?.remMinutes ?? 0,
    deepMinutes: rec?.deepMinutes ?? 0,
    consistency: rec?.sleepConsistency ?? baseline30('sleepConsistency' as keyof WhoopDayRecord),
  }
}

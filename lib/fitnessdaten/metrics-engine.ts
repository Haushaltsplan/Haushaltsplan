/** WHOOP-Dashboard-Modell aus BLE-Daten + Tageshistorie. */

import { erkenneAktivitaeten } from '@/lib/fitnessdaten/activity-detect'
import { baueHealthspanModel, type HealthspanModel } from '@/lib/fitnessdaten/healthspan-engine'
import { ladeSyncState, type SyncState } from '@/lib/fitnessdaten/offline-sync'
import {
  aktualisiereHeuteAusSnapshot,
  aktivitaetenFuerDatum,
  baseline30,
  createEmptyDayRecord,
  journalFuerDatum,
  letzte7Tage,
  ladeDailyStore,
  schlafdefizit7Tage,
  type WhoopActivity,
  type WhoopDayRecord,
  type WhoopJournalEntry,
} from '@/lib/fitnessdaten/daily-records'
import { ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'

export type TrendRichtung = 'up' | 'down' | 'neutral'

export type MetricMitBaseline = {
  heute: number | null
  baseline30: number | null
  trend: TrendRichtung
  /** true = höher ist schlechter (RHR, Atemfrequenz) */
  invertiert?: boolean
}

export type WhoopDashboardModel = {
  heute: WhoopDayRecord
  woche: WhoopDayRecord[]
  baselines: {
    hrv: number | null
    rhr: number | null
    recovery: number | null
    strain: number | null
    sleep: number | null
    respiratory: number | null
  }
  metriken: {
    hrv: MetricMitBaseline
    rhr: MetricMitBaseline
    respiratory: MetricMitBaseline
    sleepPerformance: MetricMitBaseline
    recovery: MetricMitBaseline
  }
  schlafdefizit: { date: string; defizitMin: number; label: string }[]
  journal: WhoopJournalEntry[]
  aktivitaeten: WhoopActivity[]
  insightRecovery: string | null
  insightStrain: string | null
  insightSchlaf: string | null
  liveHr: number | null
  hrZone: number
  battery: number | null
  gen5Phase: string | null
  sync: SyncState
  coachSchlaf: string | null
  healthspan: HealthspanModel
}

function trend(heute: number | null, base: number | null, invertiert = false): TrendRichtung {
  if (heute == null || base == null) return 'neutral'
  const diff = heute - base
  if (Math.abs(diff) < base * 0.03) return 'neutral'
  const up = diff > 0
  if (invertiert) return up ? 'down' : 'up'
  return up ? 'up' : 'down'
}

function metric(heute: number | null, base: number | null, invertiert = false): MetricMitBaseline {
  return { heute, baseline30: base, trend: trend(heute, base, invertiert), invertiert }
}

function wochentagKurz(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' })
}

export function baueWhoopDashboard(snapshot: FitnessSnapshot | null): WhoopDashboardModel {
  const history = ladeFitnessHistory()
  const heuteRecord = snapshot ? aktualisiereHeuteAusSnapshot(snapshot, history) : letzte7Tage().slice(-1)[0] ?? leereHeute()
  const woche = letzte7Tage()
  const baselines = {
    hrv: baseline30('hrvRmssd', ladeDailyStore().days),
    rhr: baseline30('restingHr', ladeDailyStore().days),
    recovery: baseline30('recoveryPercent', ladeDailyStore().days),
    strain: baseline30('strain', ladeDailyStore().days),
    sleep: baseline30('sleepScore', ladeDailyStore().days),
    respiratory: baseline30('respiratoryRate', ladeDailyStore().days),
  }

  const store = ladeDailyStore()
  const heuteIso = heuteRecord.date
  const cloudActs = aktivitaetenFuerDatum(heuteIso, store)
  const detected = erkenneAktivitaeten(
    history.hrSeries,
    heuteRecord.restingHr ?? history.baselines.restingHrBpm,
  )
  const aktivitaeten =
    cloudActs.length > 0
      ? cloudActs
      : detected.length > 0
        ? detected
        : store.activitiesToday
  const journal = journalFuerDatum(heuteIso, store)

  const hrvHeute = heuteRecord.hrvRmssd
  const hrvBase = baselines.hrv ?? history.baselines.hrvRmssdMs
  let insightRecovery: string | null = null
  if (hrvHeute != null && hrvBase != null && hrvBase > 0) {
    const pct = Math.round(((hrvHeute - hrvBase) / hrvBase) * 100)
    if (pct < -20) {
      insightRecovery = `Deine HFV ist ${Math.abs(pct)} % niedriger als sonst — Schone dich heute für bessere Erholung.`
    } else if (pct > 15) {
      insightRecovery = `Deine HFV liegt ${pct} % über dem 30-Tage-Schnitt — gute Erholungslage.`
    }
  }

  const strain = heuteRecord.strain
  let insightStrain: string | null = null
  if (strain != null && strain > 14) {
    insightStrain =
      'Hohe Belastung heute. Denk daran, morgen Erholung Priorität zu geben, damit dein Körper regenerieren kann.'
  } else if (strain != null && strain > 8 && strain <= 14) {
    insightStrain = 'Du liegst im intensiven Belastungsbereich — gut für Fitness, achte auf Schlaf heute Nacht.'
  }

  const schlafdefizit = schlafdefizit7Tage().map((s) => ({
    ...s,
    label: wochentagKurz(s.date),
  }))

  const liveHr = snapshot?.live?.heartRateBpm ?? null
  const hrZone =
    liveHr != null && heuteRecord.restingHr != null
      ? liveHr < heuteRecord.restingHr + 10
        ? 0
        : liveHr < heuteRecord.restingHr + 30
          ? 1
          : 2
      : 0

  const coachSchlaf =
    heuteRecord.sleepScore != null && heuteRecord.sleepScore < 60
      ? 'Dein Schlaf wurde heute Nacht eher durch zu wenig Zeit im Bett begrenzt — nicht durch schlechte Qualität im Bett.'
      : heuteRecord.sleepEfficiency != null && heuteRecord.sleepEfficiency >= 85
        ? 'Dein Schlaf wurde heute Nacht nicht von der Qualität im Bett gebremst — Effizienz sieht solide aus.'
        : null

  return {
    heute: heuteRecord,
    woche,
    baselines,
    metriken: {
      hrv: metric(hrvHeute, hrvBase),
      rhr: metric(heuteRecord.restingHr, baselines.rhr, true),
      respiratory: metric(heuteRecord.respiratoryRate, baselines.respiratory, true),
      sleepPerformance: metric(heuteRecord.sleepScore, baselines.sleep),
      recovery: metric(heuteRecord.recoveryPercent, baselines.recovery),
    },
    schlafdefizit,
    journal,
    aktivitaeten,
    insightRecovery,
    insightStrain,
    insightSchlaf:
      heuteRecord.sleepScore != null && heuteRecord.sleepScore < 50
        ? 'Schlaf heute unter dem üblichen Niveau — früh ins Bett kann morgen die Recovery verbessern.'
        : null,
    liveHr,
    hrZone,
    battery: snapshot?.deviceInfo?.batteryPercent ?? null,
    gen5Phase: snapshot?.gen5?.phase ?? null,
    sync: ladeSyncState(),
    coachSchlaf,
    healthspan: baueHealthspanModel(heuteRecord),
  }
}

function leereHeute(): WhoopDayRecord {
  return createEmptyDayRecord(heuteIsoLocal())
}

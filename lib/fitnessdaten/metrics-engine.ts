/** WHOOP-Dashboard-Modell aus BLE-Daten + Tageshistorie. */

import { erkenneAktivitaeten } from '@/lib/fitnessdaten/activity-detect'
import { baueHealthspanModel, type HealthspanModel } from '@/lib/fitnessdaten/healthspan-engine'
import { ladeSyncState, type SyncState } from '@/lib/fitnessdaten/offline-sync'
import {
  aktualisiereHeuteAusSnapshot,
  aktivitaetenFuerDatum,
  aktivitaetenLetzteTage,
  baseline30,
  ergaenzeZonenUndVitals,
  fenster7TageUmDatum,
  journalFuerDatum,
  ladeDailyStore,
  schlafdefizit7Tage,
  tagRecordFuerDatum,
  type WhoopActivity,
  type WhoopDayRecord,
  type WhoopJournalEntry,
} from '@/lib/fitnessdaten/daily-records'
import { ladeFitnessHistory, aktualisiereStrainFuerAnzeige } from '@/lib/fitnessdaten/history-storage'
import { heuteIsoLocal, zoneFuerBpm } from '@/lib/fitnessdaten/scores'
import { profilMaxHr, ladeFitnessProfil } from '@/lib/fitnessdaten/user-profile'
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
  /** Gewählter Tag (ISO); Daten in `heute` beziehen sich auf diesen Tag. */
  selectedDate: string
  istHeute: boolean
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
  aktivitaetenHistorie: WhoopActivity[]
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

export function baueWhoopDashboard(
  snapshot: FitnessSnapshot | null,
  selectedDate: string = heuteIsoLocal(),
): WhoopDashboardModel {
  const istHeute = selectedDate === heuteIsoLocal()
  if (snapshot && istHeute) aktualisiereStrainFuerAnzeige()
  const history = ladeFitnessHistory()
  const store = ladeDailyStore()

  const tagRecord = istHeute && snapshot
    ? aktualisiereHeuteAusSnapshot(snapshot, history)
    : ergaenzeZonenUndVitals(tagRecordFuerDatum(selectedDate, store), history, store)

  const woche = fenster7TageUmDatum(selectedDate)
  const baselines = {
    hrv: baseline30('hrvRmssd', ladeDailyStore().days),
    rhr: baseline30('restingHr', ladeDailyStore().days),
    recovery: baseline30('recoveryPercent', ladeDailyStore().days),
    strain: baseline30('strain', ladeDailyStore().days),
    sleep: baseline30('sleepScore', ladeDailyStore().days),
    respiratory: baseline30('respiratoryRate', ladeDailyStore().days),
  }

  const tagIso = tagRecord.date
  const cloudActs = aktivitaetenFuerDatum(tagIso, store)
  const detected =
    istHeute
      ? erkenneAktivitaeten(
          history.hrSeries,
          tagRecord.restingHr ?? history.baselines.restingHrBpm,
        )
      : []
  const aktivitaeten =
    cloudActs.length > 0
      ? cloudActs
      : detected.length > 0
        ? detected
        : istHeute
          ? store.activitiesToday
          : []
  const journal = journalFuerDatum(tagIso, store)

  const hrvHeute = tagRecord.hrvRmssd
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

  const strain = tagRecord.strain
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

  const liveHr = istHeute ? (snapshot?.live?.heartRateBpm ?? null) : null
  const rhrLive = tagRecord.restingHr ?? history.baselines.restingHrBpm
  const maxHrLive = tagRecord.maxHr ?? profilMaxHr(ladeFitnessProfil())
  const zoneKey =
    liveHr != null && liveHr > 0 ? zoneFuerBpm(liveHr, maxHrLive, rhrLive) : 'rest'
  const hrZone =
    zoneKey === 'rest' ? 0 : zoneKey === 'z1' || zoneKey === 'z2' ? 1 : zoneKey === 'z3' ? 2 : 3

  const aktivitaetenHistorie = aktivitaetenLetzteTage(21, store)

  const coachSchlaf =
    tagRecord.sleepScore != null && tagRecord.sleepScore < 60
      ? 'Dein Schlaf wurde in dieser Nacht eher durch zu wenig Zeit im Bett begrenzt — nicht durch schlechte Qualität im Bett.'
      : tagRecord.sleepEfficiency != null && tagRecord.sleepEfficiency >= 85
        ? 'Dein Schlaf wurde in dieser Nacht nicht von der Qualität im Bett gebremst — Effizienz sieht solide aus.'
        : null

  return {
    selectedDate,
    istHeute,
    heute: tagRecord,
    woche,
    baselines,
    metriken: {
      hrv: metric(hrvHeute, hrvBase),
      rhr: metric(tagRecord.restingHr, baselines.rhr, true),
      respiratory: metric(tagRecord.respiratoryRate, baselines.respiratory, true),
      sleepPerformance: metric(tagRecord.sleepScore, baselines.sleep),
      recovery: metric(tagRecord.recoveryPercent, baselines.recovery),
    },
    schlafdefizit,
    journal,
    aktivitaeten,
    aktivitaetenHistorie,
    insightRecovery,
    insightStrain,
    insightSchlaf:
      tagRecord.sleepScore != null && tagRecord.sleepScore < 50
        ? 'Schlaf an diesem Tag unter dem üblichen Niveau — früh ins Bett kann die Recovery verbessern.'
        : null,
    liveHr,
    hrZone,
    battery: snapshot?.deviceInfo?.batteryPercent ?? null,
    gen5Phase: snapshot?.gen5?.phase ?? null,
    sync: ladeSyncState(),
    coachSchlaf,
    healthspan: baueHealthspanModel(tagRecord),
  }
}

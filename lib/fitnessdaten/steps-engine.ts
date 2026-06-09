/**
 * Schritte — WHOOP-nah ohne Kalorien-Fehlschätzung.
 * Quellen: BLE/Gen5-IMU (primär), Strain+Zonen (Cloud-Fallback), CSV-Import.
 */

import {
  createEmptyDayRecord,
  ladeDailyStore,
  speichereDailyStore,
} from '@/lib/fitnessdaten/daily-records'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import { zaehleSchrittAusAccel } from '@/lib/fitnessdaten/steps-tracker'

/** WHOOP: Grundbewegung am Handgelenk + Belastungs-Korrektur (nicht aus Gesamt-Kalorien!). */
export function schaetzeSchritteAusStrain(
  strain: number | null,
  zoneMin13: number,
  avgHr: number | null,
  restingHr: number,
): number {
  const s = strain ?? 0
  const basis = 2200
  const ausStrain = s * 380
  const ausZonen = zoneMin13 * 105
  let hrBonus = 0
  if (avgHr != null && restingHr > 0 && avgHr > restingHr + 12) {
    hrBonus = Math.round((avgHr - restingHr) * 18)
  }
  return Math.round(basis + ausStrain + ausZonen + hrBonus)
}

export function mergeTagesSchritte(
  prev: number | null,
  accelHeute: number,
  strain: number | null,
  zoneMin13: number,
  avgHr: number | null,
  restingHr: number,
): number | null {
  const geschaetzt = schaetzeSchritteAusStrain(strain, zoneMin13, avgHr, restingHr)
  const kandidaten = [
    prev != null && prev > 0 ? prev : null,
    accelHeute > 0 ? accelHeute : null,
    geschaetzt > 0 ? geschaetzt : null,
  ].filter((v): v is number => v != null)

  if (kandidaten.length === 0) return prev

  const accelUndPrev = [prev, accelHeute].filter((v): v is number => v != null && v > 0)
  if (accelUndPrev.length >= 1) {
    const accelBest = Math.max(...accelUndPrev)
    if (accelBest >= 500) return Math.round(accelBest)
  }

  if (prev != null && prev > 0 && geschaetzt > 0) {
    return Math.round(Math.max(prev, Math.min(geschaetzt * 1.15, geschaetzt + 800)))
  }

  return Math.round(Math.max(...kandidaten))
}

/** Schritt aus IMU zählen und direkt im Tagesrecord speichern. */
export function verarbeiteAccelSchritt(
  accel: { x: number; y: number; z: number },
  ts: number,
  isoDate = new Date(ts).toISOString().slice(0, 10),
): boolean {
  if (!zaehleSchrittAusAccel(accel, ts)) return false

  const store = ladeDailyStore()
  let rec = store.days.find((d) => d.date === isoDate)
  if (!rec) {
    rec = createEmptyDayRecord(isoDate)
    store.days.push(rec)
  }
  if (rec.bffMetrics) return true
  rec.steps = (rec.steps ?? 0) + 1
  store.days.sort((a, b) => a.date.localeCompare(b.date))
  if (store.days.length > 365) store.days = store.days.slice(-365)
  speichereDailyStore(store)

  if (isoDate === heuteIsoLocal()) {
    return true
  }
  return true
}

export function schritteHeuteAusDaily(): number {
  const heute = heuteIsoLocal()
  return ladeDailyStore().days.find((d) => d.date === heute)?.steps ?? 0
}

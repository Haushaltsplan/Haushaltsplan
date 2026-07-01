/**
 * WHOOP-ähnlicher Tages-Strain (0–21):
 * - Banister-TRIMP pro HF-Sample (%HRR, personalisiert)
 * - Interner Load mit exponentiellem Abklingen (schneller in Ruhe)
 * - Logarithmische 0–21-Skala (Borg/WHOOP-Prinzip)
 *
 * Approximation publizierter Sportwissenschaft — nicht WHOOPs proprietäre Formel.
 * Mit WHOOP Cloud: API-Zyklus-Strain hat Vorrang (strainFromCloud).
 */

import type { HrZoneKey, HrZoneMinutes } from '@/lib/fitnessdaten/types'

/** Edwards-Gewichte für statische Zonen-Summe (Import/Backfill). */
const EDWARDS_WEIGHT: Record<HrZoneKey, number> = {
  rest: 0,
  z1: 1,
  z2: 2,
  z3: 3,
  z4: 4,
  z5: 5,
}

/** NOOP/OpenStrap: 21 bei TRIMP 7200 (24 h Zone 5). */
const STRAIN_LOG_BASE = 7201

const TAU_REST_SEC = 4000
const TAU_MAX_SEC = 14_400

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

export function begrenzeStrain(s: number): number {
  return Math.min(21, Math.round(Math.max(0, s) * 10) / 10)
}

/** % Herzfrequenz-Reserve 0–1 (Karvonen). */
export function hrrAnteil(bpm: number, maxHr: number, restingHr: number): number {
  const reserve = Math.max(maxHr - restingHr, 40)
  return clamp01((bpm - restingHr) / reserve)
}

/** Banister-TRIMP-Rate pro Minute (Männer k=0.64,b=1.92; Frauen k=0.86,b=1.67). */
export function banisterTrimpProMinute(hrr: number, maennlich = true): number {
  if (hrr <= 0) return 0
  const [k, b] = maennlich ? [0.64, 1.92] : [0.86, 1.67]
  return hrr * k * Math.exp(b * hrr)
}

/** Interner Load → WHOOP-Skala 0–21. */
export function strainAusLoad(load: number): number {
  if (load <= 0) return 0
  return begrenzeStrain((21 * Math.log(load + 1)) / Math.log(STRAIN_LOG_BASE))
}

/** Inverse: Cloud/API-Strain → interner Load (Kalibrierung). */
export function loadAusStrain(strain: number): number {
  if (strain <= 0) return 0
  return Math.exp((strain / 21) * Math.log(STRAIN_LOG_BASE)) - 1
}

/** Abklingzeit τ: schneller in Ruhe, langsamer bei hoher HF. */
function decayTau(hrr: number): number {
  return TAU_REST_SEC + hrr * (TAU_MAX_SEC - TAU_REST_SEC)
}

/**
 * Ein HF-Tick: Load baut auf und klingt gleichzeitig ab (WHOOP-Live-Verhalten).
 */
export function tickStrainLoad(
  load: number,
  bpm: number,
  maxHr: number,
  restingHr: number,
  dtSec: number,
  maennlich = true,
): number {
  if (dtSec <= 0) return Math.max(0, load)
  const dt = Math.min(300, dtSec)
  const hrr = hrrAnteil(bpm, maxHr, restingHr)
  const tau = decayTau(hrr)
  let next = load * Math.exp(-dt / tau)
  next += banisterTrimpProMinute(hrr, maennlich) * (dt / 60)
  return Math.max(0, next)
}

/** Abklingen ohne HF (Band getrennt / Ruhe). */
export function decayStrainLoad(load: number, dtSec: number): number {
  if (dtSec <= 0 || load <= 0) return Math.max(0, load)
  const dt = Math.min(7200, dtSec)
  return Math.max(0, load * Math.exp(-dt / TAU_REST_SEC))
}

/** Edwards-TRIMP aus Zonen-Minuten (historisch / ohne Decay). */
export function edwardsTrimpAusZonen(zoneSeconds: HrZoneMinutes): number {
  let trimp = 0
  for (const key of Object.keys(EDWARDS_WEIGHT) as HrZoneKey[]) {
    trimp += (zoneSeconds[key] / 60) * EDWARDS_WEIGHT[key]
  }
  return trimp
}

/** Statischer Tages-Strain aus kumulierten Zonen (Import, keine Live-Daten). */
export function strainAusZonen(zoneSeconds: HrZoneMinutes): number {
  return strainAusLoad(edwardsTrimpAusZonen(zoneSeconds))
}

/** Live-Strain aus internem Load. */
export function strainAusStrainLoad(load: number): number {
  return strainAusLoad(load)
}

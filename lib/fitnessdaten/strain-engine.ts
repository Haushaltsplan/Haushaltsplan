/**
 * WHOOP-ähnlicher Tages-Strain (0–21):
 * - Banister-TRIMP pro HF-Sample (%HRR, personalisiert)
 * - Interner Load mit exponentiellem Abklingen
 * - Logarithmische 0–21-Skala
 *
 * Parameter aus calibration-params (Fit gegen Cloud solange Abo aktiv).
 */

import { ladeCalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'
import type { HrZoneKey, HrZoneMinutes } from '@/lib/fitnessdaten/types'

const EDWARDS_WEIGHT: Record<HrZoneKey, number> = {
  rest: 0,
  z1: 1,
  z2: 2,
  z3: 3,
  z4: 4,
  z5: 5,
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

export function begrenzeStrain(s: number): number {
  return Math.min(21, Math.round(Math.max(0, s) * 10) / 10)
}

export function hrrAnteil(bpm: number, maxHr: number, restingHr: number): number {
  const reserve = Math.max(maxHr - restingHr, 40)
  return clamp01((bpm - restingHr) / reserve)
}

export function banisterTrimpProMinute(hrr: number, maennlich = true): number {
  if (hrr <= 0) return 0
  const [k, b] = maennlich ? [0.64, 1.92] : [0.86, 1.67]
  return hrr * k * Math.exp(b * hrr)
}

export function strainAusLoad(load: number): number {
  if (load <= 0) return 0
  const p = ladeCalibrationParams()
  const raw = (21 * Math.log(load + 1)) / Math.log(Math.max(100, p.strainLogBase))
  return begrenzeStrain(raw * p.strainScale)
}

export function loadAusStrain(strain: number): number {
  if (strain <= 0) return 0
  const p = ladeCalibrationParams()
  const unscaled = strain / Math.max(0.01, p.strainScale)
  return Math.exp((unscaled / 21) * Math.log(Math.max(100, p.strainLogBase))) - 1
}

function decayTau(hrr: number): number {
  const p = ladeCalibrationParams()
  return p.strainTauRestSec + hrr * (p.strainTauMaxSec - p.strainTauRestSec)
}

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

export function decayStrainLoad(load: number, dtSec: number): number {
  if (dtSec <= 0 || load <= 0) return Math.max(0, load)
  const p = ladeCalibrationParams()
  const dt = Math.min(7200, dtSec)
  return Math.max(0, load * Math.exp(-dt / p.strainTauRestSec))
}

export function edwardsTrimpAusZonen(zoneSeconds: HrZoneMinutes): number {
  let trimp = 0
  for (const key of Object.keys(EDWARDS_WEIGHT) as HrZoneKey[]) {
    trimp += (zoneSeconds[key] / 60) * EDWARDS_WEIGHT[key]
  }
  return trimp
}

export function strainAusZonen(zoneSeconds: HrZoneMinutes): number {
  return strainAusLoad(edwardsTrimpAusZonen(zoneSeconds))
}

export function strainAusStrainLoad(load: number): number {
  return strainAusLoad(load)
}

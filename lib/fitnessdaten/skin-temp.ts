/** Hauttemperatur — absolute WHOOP-Werte in Δ zur Baseline (wie WHOOP-App). */

import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'

const ABSOLUTE_MIN_C = 25

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

/** true = WHOOP liefert bereits Abweichung (typisch −2 … +2 °C). */
export function istSkinTempAbweichung(tempC: number): boolean {
  return Math.abs(tempC) < ABSOLUTE_MIN_C
}

/** Baseline aus vergangenen Tageswerten (ohne heute). */
export function skinTempBaselineAusHistorie(
  days: WhoopDayRecord[],
  heuteIso: string,
): number | null {
  const temps: number[] = []
  for (const d of days) {
    if (d.date === heuteIso || d.skinTempC == null) continue
    if (istSkinTempAbweichung(d.skinTempC)) continue
    temps.push(d.skinTempC)
  }
  if (temps.length < 3) return null
  return Math.round(median(temps.slice(-30)) * 10) / 10
}

/** Δ zur Baseline; aktualisiert Baseline bei absoluten Messwerten. */
export function berechneSkinTempDelta(
  tempC: number,
  baseline: number | null,
  historyDays: WhoopDayRecord[],
  heuteIso: string,
): { skinTempC: number; skinTempDelta: number; skinTempBaseline: number | null } {
  if (istSkinTempAbweichung(tempC)) {
    return {
      skinTempC: tempC,
      skinTempDelta: Math.round(tempC * 10) / 10,
      skinTempBaseline: baseline,
    }
  }

  let base = baseline ?? skinTempBaselineAusHistorie(historyDays, heuteIso)
  if (base == null) {
    base = tempC
    return { skinTempC: tempC, skinTempDelta: 0, skinTempBaseline: base }
  }

  const delta = Math.round((tempC - base) * 10) / 10
  const neuerBaseline = Math.round((base * 0.92 + tempC * 0.08) * 10) / 10
  return { skinTempC: tempC, skinTempDelta: delta, skinTempBaseline: neuerBaseline }
}

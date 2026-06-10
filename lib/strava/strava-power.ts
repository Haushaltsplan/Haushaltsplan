/** Strava — Watt-Streams auswerten (1 min, 5 min, 20 min, …). */

export type StravaPowerPeaks = {
  max_1s: number | null
  avg_5s: number | null
  avg_1min: number | null
  avg_5min: number | null
  avg_20min: number | null
  avg_60min: number | null
}

const FENSTER: { key: keyof StravaPowerPeaks; sek: number }[] = [
  { key: 'avg_5s', sek: 5 },
  { key: 'avg_1min', sek: 60 },
  { key: 'avg_5min', sek: 300 },
  { key: 'avg_20min', sek: 1200 },
  { key: 'avg_60min', sek: 3600 },
]

/** kJ (Strava) → kcal */
export function kilojoulesZuKcal(kj: number | null | undefined): number | null {
  if (kj == null || !Number.isFinite(kj) || kj <= 0) return null
  return kj / 4.184
}

export function geschwindigkeitKmh(distanceM: number, movingTimeS: number): number | null {
  if (movingTimeS <= 0 || distanceM <= 0) return null
  return (distanceM / movingTimeS) * 3.6
}

/** Beste Mittel-Leistung über ein Zeitfenster (Sekunden) aus Watt-Zeitreihe. */
export function besteMittelLeistungFenster(
  watts: number[],
  timeS: number[],
  fensterSek: number,
): number | null {
  if (watts.length < 2 || watts.length !== timeS.length) return null
  const n = watts.length
  let best: number | null = null
  let j = 0
  for (let i = 0; i < n; i++) {
    while (j < n && timeS[j] - timeS[i] < fensterSek) j++
    if (j >= n) break
    const end = j
    let sum = 0
    let count = 0
    for (let k = i; k < end; k++) {
      const w = watts[k]
      if (w > 0) {
        sum += w
        count++
      }
    }
    if (count > 0) {
      const avg = sum / count
      if (best == null || avg > best) best = avg
    }
  }
  return best
}

export function berechnePowerPeaksAusStream(watts: number[], timeS: number[]): StravaPowerPeaks {
  const positive = watts.filter((w) => w > 0)
  const max1s = positive.length > 0 ? Math.max(...positive) : null

  const peaks: StravaPowerPeaks = {
    max_1s: max1s,
    avg_5s: null,
    avg_1min: null,
    avg_5min: null,
    avg_20min: null,
    avg_60min: null,
  }

  if (timeS.length < 2) return peaks

  const duration = timeS[timeS.length - 1] - timeS[0]
  for (const { key, sek } of FENSTER) {
    if (duration >= sek * 0.9) {
      peaks[key] = besteMittelLeistungFenster(watts, timeS, sek)
    }
  }
  return peaks
}

export function parsePowerPeaks(raw: unknown): StravaPowerPeaks | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (k: string) => {
    const v = o[k]
    return v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null
  }
  const peaks: StravaPowerPeaks = {
    max_1s: num('max_1s'),
    avg_5s: num('avg_5s'),
    avg_1min: num('avg_1min'),
    avg_5min: num('avg_5min'),
    avg_20min: num('avg_20min'),
    avg_60min: num('avg_60min'),
  }
  const hatWert = Object.values(peaks).some((v) => v != null)
  return hatWert ? peaks : null
}

export const POWER_PEAK_LABELS: Record<keyof StravaPowerPeaks, string> = {
  max_1s: 'Peak 1 s',
  avg_5s: 'Ø 5 s',
  avg_1min: 'Ø 1 min',
  avg_5min: 'Ø 5 min',
  avg_20min: 'Ø 20 min',
  avg_60min: 'Ø 60 min',
}

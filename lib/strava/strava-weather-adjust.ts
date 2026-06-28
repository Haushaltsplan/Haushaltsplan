/** Strava — Leistung wetter-adjustiert einordnen. */

import { istRadAktivitaet, leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import { wetterCodeDe } from '@/lib/strava/strava-weather'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

/** Referenz-Temperatur für „ideale“ Bedingungen (°C). */
export const REFERENZ_TEMP_C = 20

/**
 * Leistungsfaktor relativ zur Referenztemperatur (0.72–1.02).
 * 1.0 ≈ optimale Bedingungen (~18–22 °C).
 * Hitze (32 °C) → ~0.84 → 250 W wirken wie ~298 W bei 20 °C.
 */
export function wetterLeistungsFaktor(tempC: number): number {
  if (!Number.isFinite(tempC)) return 1
  const optimal = 20
  if (tempC >= 14 && tempC <= 22) {
    const dist = Math.abs(tempC - optimal)
    return 1 - dist * 0.004
  }
  if (tempC < 14) {
    return Math.max(0.88, 1 - (14 - tempC) * 0.008)
  }
  if (tempC <= 28) {
    return Math.max(0.82, 1 - (tempC - 22) * 0.015)
  }
  return Math.max(0.72, 0.91 - (tempC - 28) * 0.022)
}

export function normalisiereLeistungBeiReferenz(watts: number, tempC: number): number {
  const f = wetterLeistungsFaktor(tempC)
  return watts / Math.max(f, 0.72)
}

export function tempBucketLabel(tempC: number): string {
  if (tempC < 10) return '< 10 °C'
  if (tempC < 15) return '10–15 °C'
  if (tempC < 20) return '15–20 °C'
  if (tempC < 25) return '20–25 °C'
  if (tempC < 30) return '25–30 °C'
  return '≥ 30 °C'
}

export type WetterBucketStat = {
  bucket: string
  rides: number
  avgWatts: number | null
  avgWkg: number | null
  avgTempC: number
}

export type WetterRideInsight = {
  stravaId: number
  name: string
  date: string
  tempC: number
  windKmh: number | null
  weatherLabel: string
  rawWatts: number
  rawWkg: number | null
  normalizedWatts: number
  normalizedWkg: number | null
  vsBucketPct: number | null
  contextLabel: string
}

export type WetterLeistungsAnalyse = {
  buckets: WetterBucketStat[]
  recentInsights: WetterRideInsight[]
  optimalTempRange: string
  ridesWithWeather: number
  ridesMissingWeather: number
}

function qualifizierteLeistungsfahrten(activities: StravaActivityRow[]): StravaActivityRow[] {
  return activities.filter(
    (a) =>
      istRadAktivitaet(a) &&
      a.moving_time_s >= 20 * 60 &&
      leistungWatts(a) != null &&
      a.weather_temp_c != null &&
      Number.isFinite(a.weather_temp_c),
  )
}

export function berechneWetterLeistungsAnalyse(
  activities: StravaActivityRow[],
  weightKg: number | null,
): WetterLeistungsAnalyse {
  const rides = qualifizierteLeistungsfahrten(activities)
  const allPowerRides = activities.filter(
    (a) => istRadAktivitaet(a) && leistungWatts(a) != null && a.moving_time_s >= 20 * 60,
  )
  const missing = allPowerRides.filter((a) => a.weather_temp_c == null).length

  const bucketMap = new Map<string, { watts: number[]; wkg: number[]; temps: number[] }>()
  for (const a of rides) {
    const temp = a.weather_temp_c!
    const key = tempBucketLabel(temp)
    const entry = bucketMap.get(key) ?? { watts: [], wkg: [], temps: [] }
    const w = leistungWatts(a)!
    entry.watts.push(w)
    const wkg = wattProKg(w, weightKg)
    if (wkg != null) entry.wkg.push(wkg)
    entry.temps.push(temp)
    bucketMap.set(key, entry)
  }

  const bucketOrder = ['< 10 °C', '10–15 °C', '15–20 °C', '20–25 °C', '25–30 °C', '≥ 30 °C']
  const buckets: WetterBucketStat[] = bucketOrder
    .filter((b) => bucketMap.has(b))
    .map((bucket) => {
      const e = bucketMap.get(bucket)!
      const avgW =
        e.watts.length > 0 ? Math.round(e.watts.reduce((s, v) => s + v, 0) / e.watts.length) : null
      const avgWkg =
        e.wkg.length > 0
          ? Math.round((e.wkg.reduce((s, v) => s + v, 0) / e.wkg.length) * 100) / 100
          : null
      const avgTemp =
        e.temps.length > 0 ? Math.round((e.temps.reduce((s, v) => s + v, 0) / e.temps.length) * 10) / 10 : 0
      return { bucket, rides: e.watts.length, avgWatts: avgW, avgWkg, avgTempC: avgTemp }
    })

  const bucketAvgWatts = new Map<string, number>()
  for (const b of buckets) {
    if (b.avgWatts != null) bucketAvgWatts.set(b.bucket, b.avgWatts)
  }

  const recentInsights: WetterRideInsight[] = [...rides]
    .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))
    .slice(0, 12)
    .map((a) => {
      const temp = a.weather_temp_c!
      const rawW = leistungWatts(a)!
      const normW = Math.round(normalisiereLeistungBeiReferenz(rawW, temp))
      const bucket = tempBucketLabel(temp)
      const bucketAvg = bucketAvgWatts.get(bucket)
      const vsBucketPct =
        bucketAvg != null && bucketAvg > 0 ? Math.round(((rawW - bucketAvg) / bucketAvg) * 100) : null
      const rawWkg = wattProKg(rawW, weightKg)
      const normWkg = wattProKg(normW, weightKg)

      let contextLabel: string
      if (temp >= 28) {
        contextLabel =
          vsBucketPct != null && vsBucketPct >= 0
            ? `Stark für ${Math.round(temp)} °C — ${vsBucketPct >= 0 ? '+' : ''}${vsBucketPct}% vs. dein Schnitt bei Hitze`
            : `Bei ${Math.round(temp)} °C — entspricht ca. ${normW} W bei ${REFERENZ_TEMP_C} °C`
      } else if (temp >= 20 && temp <= 24) {
        contextLabel = 'Ideale Temperatur — Leistung direkt vergleichbar'
      } else if (temp < 12) {
        contextLabel = `Kühl (${Math.round(temp)} °C) — normalisiert ca. ${normW} W bei ${REFERENZ_TEMP_C} °C`
      } else {
        contextLabel = `Bei ${Math.round(temp)} °C — normalisiert ca. ${normW} W bei ${REFERENZ_TEMP_C} °C`
      }

      return {
        stravaId: a.strava_id,
        name: a.name,
        date: a.start_date,
        tempC: temp,
        windKmh: a.weather_wind_kmh ?? null,
        weatherLabel: wetterCodeDe(a.weather_code),
        rawWatts: rawW,
        rawWkg,
        normalizedWatts: normW,
        normalizedWkg: normWkg,
        vsBucketPct,
        contextLabel,
      }
    })

  return {
    buckets,
    recentInsights,
    optimalTempRange: '18–22 °C',
    ridesWithWeather: rides.length,
    ridesMissingWeather: missing,
  }
}

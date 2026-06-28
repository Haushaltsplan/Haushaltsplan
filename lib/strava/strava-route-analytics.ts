/** Strava — Wiederkehrende Strecken erkennen & vergleichen. */

import { istRadAktivitaet, leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import { decodePolyline } from '@/lib/strava/strava-polyline'
import { startpunktAusPolyline } from '@/lib/strava/strava-weather'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type RoutePrEntry = {
  activityId: number
  name: string
  date: string
  dateLabel: string
  distanceKm: number
  avgWatts: number | null
  avgWkg: number | null
  avgSpeedKmh: number | null
  movingMin: number
  isBest: boolean
}

export type RouteCluster = {
  routeKey: string
  label: string
  rides: number
  avgDistanceKm: number
  bestWatts: number | null
  bestWkg: number | null
  trendPct: number | null
  entries: RoutePrEntry[]
}

export type RouteAnalytics = {
  clusters: RouteCluster[]
  totalMatched: number
}

const START_RADIUS_KM = 0.8
const END_RADIUS_KM = 0.8
const MIN_DISTANCE_KM = 8
const MIN_RIDES = 2

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function endpunktAusPolyline(polyline: string | null | undefined): { lat: number; lon: number } | null {
  if (!polyline?.trim()) return null
  const pts = decodePolyline(polyline.trim())
  if (!pts.length) return null
  const [lat, lon] = pts[pts.length - 1]
  return { lat, lon }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d{1,2}[./]\d{1,2}([./]\d{2,4})?/g, '')
    .replace(/\b(morgen|abend|mittag|früh|frueh|ride|fahrt|rad|training|home|hausbach|haarbach)\b/gi, '')
    .replace(/[^a-zäöüß0-9]+/g, ' ')
    .trim()
    .slice(0, 40)
}

function routeEndpoints(a: StravaActivityRow): {
  start: { lat: number; lon: number }
  end: { lat: number; lon: number }
} | null {
  const start = startpunktAusPolyline(a.summary_polyline)
  const end = endpunktAusPolyline(a.summary_polyline)
  if (!start || !end) return null
  return { start, end }
}

function endpointsMatch(
  a: { start: { lat: number; lon: number }; end: { lat: number; lon: number } },
  b: { start: { lat: number; lon: number }; end: { lat: number; lon: number } },
): boolean {
  const startOk = haversineKm(a.start.lat, a.start.lon, b.start.lat, b.start.lon) <= START_RADIUS_KM
  const endOk = haversineKm(a.end.lat, a.end.lon, b.end.lat, b.end.lon) <= END_RADIUS_KM
  const revStart = haversineKm(a.start.lat, a.start.lon, b.end.lat, b.end.lon) <= START_RADIUS_KM
  const revEnd = haversineKm(a.end.lat, a.end.lon, b.start.lat, b.start.lon) <= END_RADIUS_KM
  return (startOk && endOk) || (revStart && revEnd)
}

function clusterKey(a: StravaActivityRow): string | null {
  const ep = routeEndpoints(a)
  if (!ep) {
    const norm = normalizeName(a.name)
    return norm.length >= 4 ? `name:${norm}` : null
  }
  const s = `${ep.start.lat.toFixed(2)},${ep.start.lon.toFixed(2)}`
  const e = `${ep.end.lat.toFixed(2)},${ep.end.lon.toFixed(2)}`
  return `geo:${s}|${e}`
}

function mergeByGeo(clusters: Map<string, StravaActivityRow[]>): Map<string, StravaActivityRow[]> {
  const keys = [...clusters.keys()]
  const merged = new Map<string, StravaActivityRow[]>()
  const used = new Set<string>()

  for (const k of keys) {
    if (used.has(k)) continue
    const list = [...(clusters.get(k) ?? [])]
    used.add(k)

    if (!k.startsWith('geo:')) {
      merged.set(k, list)
      continue
    }

    const ref = list[0]
    const refEp = ref ? routeEndpoints(ref) : null
    if (!refEp) {
      merged.set(k, list)
      continue
    }

    for (const k2 of keys) {
      if (used.has(k2) || k2 === k || !k2.startsWith('geo:')) continue
      const other = clusters.get(k2)?.[0]
      const otherEp = other ? routeEndpoints(other) : null
      if (otherEp && endpointsMatch(refEp, otherEp)) {
        list.push(...(clusters.get(k2) ?? []))
        used.add(k2)
      }
    }
    merged.set(k, list)
  }
  return merged
}

export function berechneRouteAnalytics(
  activities: StravaActivityRow[],
  weightKg: number | null,
): RouteAnalytics {
  const rides = activities.filter(
    (a) => istRadAktivitaet(a) && a.distance_m / 1000 >= MIN_DISTANCE_KM,
  )

  const raw = new Map<string, StravaActivityRow[]>()
  for (const a of rides) {
    const key = clusterKey(a)
    if (!key) continue
    const list = raw.get(key) ?? []
    list.push(a)
    raw.set(key, list)
  }

  const merged = mergeByGeo(raw)
  const clusters: RouteCluster[] = []

  for (const [routeKey, list] of merged) {
    if (list.length < MIN_RIDES) continue

    const sorted = [...list].sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))
    const label =
      routeKey.startsWith('name:')
        ? sorted[0].name.trim().slice(0, 48) || 'Strecke'
        : sorted[0].name.trim().slice(0, 48) || 'Wiederkehrende Route'

    let bestW: number | null = null
    let bestWkg: number | null = null

    const entries: RoutePrEntry[] = sorted.map((a) => {
      const w = leistungWatts(a)
      const wkg = w != null ? wattProKg(w, weightKg) : null
      const kmh = a.average_speed_kmh
      if (w != null && (bestW == null || w > bestW)) bestW = w
      if (wkg != null && (bestWkg == null || wkg > bestWkg)) bestWkg = wkg
      return {
        activityId: a.strava_id,
        name: a.name,
        date: a.start_date,
        dateLabel: new Date(a.start_date).toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'short',
          year: '2-digit',
        }),
        distanceKm: Math.round((a.distance_m / 1000) * 10) / 10,
        avgWatts: w != null ? Math.round(w) : null,
        avgWkg: wkg,
        avgSpeedKmh: kmh != null ? Math.round(kmh * 10) / 10 : null,
        movingMin: Math.round(a.moving_time_s / 60),
        isBest: false,
      }
    })

    const withPower = entries.filter((e) => e.avgWatts != null)
    if (withPower.length > 0) {
      const maxW = Math.max(...withPower.map((e) => e.avgWatts!))
      for (const e of entries) {
        if (e.avgWatts === maxW) e.isBest = true
      }
    }

    const avgKm = list.reduce((s, a) => s + a.distance_m, 0) / list.length / 1000

    let trendPct: number | null = null
    const powerEntries = entries.filter((e) => e.avgWatts != null)
    if (powerEntries.length >= 3) {
      const first = powerEntries[0].avgWatts!
      const last = powerEntries[powerEntries.length - 1].avgWatts!
      if (first > 0) trendPct = Math.round(((last - first) / first) * 100)
    }

    clusters.push({
      routeKey,
      label,
      rides: list.length,
      avgDistanceKm: Math.round(avgKm),
      bestWatts: bestW,
      bestWkg,
      trendPct,
      entries: entries.slice(-8).reverse(),
    })
  }

  clusters.sort((a, b) => b.rides - a.rides)

  return {
    clusters: clusters.slice(0, 12),
    totalMatched: clusters.reduce((s, c) => s + c.rides, 0),
  }
}

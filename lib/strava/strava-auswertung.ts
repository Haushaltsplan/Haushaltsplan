/** Strava — Auswertungen (Jahre, PRs, W/kg). */

import {
  STRAVA_RAD_SPORT_TYPES,
  type StravaActivityRow,
  type StravaAuswertung,
  type StravaJahresStat,
  type StravaPersoenlicheBestleistung,
} from '@/lib/strava/strava-types'

const MIN_POWER_MINUTES = 20

export function istRadAktivitaet(a: { sport_type?: string; type?: string | null }): boolean {
  const st = (a.sport_type || a.type || '').trim()
  return STRAVA_RAD_SPORT_TYPES.has(st) || st === 'Ride'
}

export function wattProKg(
  watts: number | null | undefined,
  weightKg: number | null | undefined,
): number | null {
  if (watts == null || !Number.isFinite(watts) || watts <= 0) return null
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null
  return watts / weightKg
}

export function leistungWatts(a: StravaActivityRow): number | null {
  const w = a.weighted_avg_watts ?? a.average_watts
  return w != null && Number.isFinite(w) && w > 0 ? w : null
}

function formatKm(m: number): string {
  return `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`
}

function formatHm(m: number | null): string {
  if (m == null) return '—'
  return `${Math.round(m).toLocaleString('de-DE')} hm`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`
}

export function berechneJahresStatistik(
  activities: StravaActivityRow[],
  weightKg: number | null,
): StravaJahresStat[] {
  const byYear = new Map<number, StravaActivityRow[]>()
  for (const a of activities.filter(istRadAktivitaet)) {
    const y = new Date(a.start_date).getFullYear()
    const list = byYear.get(y) ?? []
    list.push(a)
    byYear.set(y, list)
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, list]) => {
      const km = list.reduce((s, a) => s + a.distance_m, 0)
      const hours = list.reduce((s, a) => s + a.moving_time_s, 0)
      const hm = list.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)
      const powerRides = list.filter((a) => leistungWatts(a) != null && a.moving_time_s >= MIN_POWER_MINUTES * 60)
      const avgWatts =
        powerRides.length > 0
          ? powerRides.reduce((s, a) => s + (leistungWatts(a) ?? 0), 0) / powerRides.length
          : null
      const wkgRides = powerRides
        .map((a) => wattProKg(leistungWatts(a), weightKg))
        .filter((v): v is number => v != null)
      const avgWkg = wkgRides.length > 0 ? wkgRides.reduce((s, v) => s + v, 0) / wkgRides.length : null
      return {
        year,
        rides: list.length,
        km: km / 1000,
        hours: hours / 3600,
        hm,
        avgWatts,
        avgWkg,
      }
    })
}

export function berechneBestleistungen(
  activities: StravaActivityRow[],
  weightKg: number | null,
): StravaPersoenlicheBestleistung[] {
  const rides = activities.filter(istRadAktivitaet)
  if (rides.length === 0) return []

  const longest = [...rides].sort((a, b) => b.distance_m - a.distance_m)[0]
  const highest = [...rides].sort((a, b) => (b.elevation_gain_m ?? 0) - (a.elevation_gain_m ?? 0))[0]

  const powerRides = rides.filter((a) => leistungWatts(a) != null && a.moving_time_s >= MIN_POWER_MINUTES * 60)
  const bestWatts = powerRides.length
    ? [...powerRides].sort((a, b) => (leistungWatts(b) ?? 0) - (leistungWatts(a) ?? 0))[0]
    : null

  const withWkg = powerRides
    .map((a) => ({ a, wkg: wattProKg(leistungWatts(a), weightKg) }))
    .filter((x): x is { a: StravaActivityRow; wkg: number } => x.wkg != null)
  const bestWkg = withWkg.length ? [...withWkg].sort((a, b) => b.wkg - a.wkg)[0] : null

  const byYear = berechneJahresStatistik(rides, weightKg)
  const bestYearKm = byYear.length ? [...byYear].sort((a, b) => b.km - a.km)[0] : null
  const bestYearRides = byYear.length ? [...byYear].sort((a, b) => b.rides - a.rides)[0] : null

  const out: StravaPersoenlicheBestleistung[] = [
    {
      key: 'longest',
      label: 'Längste Fahrt',
      value: formatKm(longest.distance_m),
      detail: longest.name,
      activityId: longest.strava_id,
      date: formatDate(longest.start_date),
    },
    {
      key: 'elevation',
      label: 'Meiste Höhenmeter',
      value: formatHm(highest.elevation_gain_m),
      detail: highest.name,
      activityId: highest.strava_id,
      date: formatDate(highest.start_date),
    },
  ]

  if (bestWatts) {
    const w = leistungWatts(bestWatts)!
    out.push({
      key: 'best_watts',
      label: `Beste Ø-Leistung (≥${MIN_POWER_MINUTES} min)`,
      value: `${Math.round(w)} W`,
      detail: bestWatts.name,
      activityId: bestWatts.strava_id,
      date: formatDate(bestWatts.start_date),
    })
  }

  if (bestWkg) {
    out.push({
      key: 'best_wkg',
      label: `Beste W/kg (≥${MIN_POWER_MINUTES} min)`,
      value: `${bestWkg.wkg.toFixed(2)} W/kg`,
      detail: bestWkg.a.name,
      activityId: bestWkg.a.strava_id,
      date: formatDate(bestWkg.a.start_date),
    })
  }

  if (bestYearKm) {
    out.push({
      key: 'year_km',
      label: 'Rekord-Jahr (Kilometer)',
      value: `${bestYearKm.km.toLocaleString('de-DE', { maximumFractionDigits: 0 })} km`,
      detail: `${bestYearKm.rides} Fahrten`,
      date: String(bestYearKm.year),
    })
  }

  if (bestYearRides) {
    out.push({
      key: 'year_rides',
      label: 'Rekord-Jahr (Fahrten)',
      value: `${bestYearRides.rides} Fahrten`,
      detail: `${bestYearRides.km.toLocaleString('de-DE', { maximumFractionDigits: 0 })} km`,
      date: String(bestYearRides.year),
    })
  }

  return out
}

export function berechneWkgMonat(
  activities: StravaActivityRow[],
  weightKg: number | null,
  monate = 24,
): { label: string; wkg: number; rides: number }[] {
  const rides = activities.filter(
    (a) => istRadAktivitaet(a) && leistungWatts(a) != null && a.moving_time_s >= MIN_POWER_MINUTES * 60,
  )
  const now = new Date()
  const buckets = new Map<string, { label: string; wkgSum: number; count: number }>()

  for (let i = monate - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
    buckets.set(key, { label, wkgSum: 0, count: 0 })
  }

  for (const a of rides) {
    const d = new Date(a.start_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key)
    const wkg = wattProKg(leistungWatts(a), weightKg)
    if (!bucket || wkg == null) continue
    bucket.wkgSum += wkg
    bucket.count += 1
  }

  return [...buckets.values()].map((b) => ({
    label: b.label,
    wkg: b.count > 0 ? b.wkgSum / b.count : 0,
    rides: b.count,
  }))
}

export function berechneAuswertung(
  activities: StravaActivityRow[],
  weightKg: number | null,
): StravaAuswertung {
  const rides = activities.filter(istRadAktivitaet)
  const totalKm = rides.reduce((s, a) => s + a.distance_m, 0) / 1000
  const totalHours = rides.reduce((s, a) => s + a.moving_time_s, 0) / 3600
  const totalHm = rides.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)

  return {
    totalRides: rides.length,
    totalKm,
    totalHours,
    totalHm,
    jahre: berechneJahresStatistik(rides, weightKg),
    bestleistungen: berechneBestleistungen(rides, weightKg),
    wkgMonat: berechneWkgMonat(rides, weightKg),
    recent: [...rides].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date)).slice(0, 30),
  }
}

export { formatKm, formatHm, formatHours, formatDate }

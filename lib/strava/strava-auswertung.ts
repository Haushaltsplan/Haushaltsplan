/** Strava — Auswertungen (Jahre, PRs, W/kg, Kalorien, Leistungs-Peaks). */

import {
  POWER_PEAK_LABELS,
  geschwindigkeitKmh,
  kilojoulesZuKcal,
  type StravaPowerPeaks,
} from '@/lib/strava/strava-power'
import {
  STRAVA_RAD_SPORT_TYPES,
  type StravaActivityRow,
  type StravaAuswertung,
  type StravaJahresStat,
  type StravaPersoenlicheBestleistung,
  type StravaPrKategorie,
} from '@/lib/strava/strava-types'

const MIN_POWER_RIDE_MIN = 10

export function istRadAktivitaet(a: { sport_type?: string; type?: string | null }): boolean {
  const st = (a.sport_type || a.type || '').trim()
  return STRAVA_RAD_SPORT_TYPES.has(st) || st === 'Ride'
}

export function aktivitaetKcal(a: StravaActivityRow): number | null {
  if (a.calories_kcal != null && a.calories_kcal > 0) return a.calories_kcal
  return kilojoulesZuKcal(a.kilojoules)
}

export function aktivitaetSpeedKmh(a: StravaActivityRow): number | null {
  if (a.average_speed_kmh != null && a.average_speed_kmh > 0) return a.average_speed_kmh
  return geschwindigkeitKmh(a.distance_m, a.moving_time_s)
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

function formatDauer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

function formatKcal(kcal: number | null): string {
  if (kcal == null) return '—'
  return `${Math.round(kcal).toLocaleString('de-DE')} kcal`
}

function pr(
  key: string,
  kategorie: StravaPrKategorie,
  label: string,
  value: string,
  a: StravaActivityRow,
  extra?: string,
): StravaPersoenlicheBestleistung {
  return {
    key,
    kategorie,
    label,
    value,
    detail: extra ?? a.name,
    activityId: a.strava_id,
    date: formatDate(a.start_date),
  }
}

function bestAusListe<T extends StravaActivityRow>(
  rides: T[],
  score: (a: T) => number | null,
): T | null {
  let best: T | null = null
  let bestVal = -Infinity
  for (const a of rides) {
    const v = score(a)
    if (v != null && v > bestVal) {
      bestVal = v
      best = a
    }
  }
  return best
}

function bestePowerPeakGlobal(
  rides: StravaActivityRow[],
  peakKey: keyof StravaPowerPeaks,
): { a: StravaActivityRow; w: number } | null {
  let best: { a: StravaActivityRow; w: number } | null = null
  for (const a of rides) {
    const peaks = a.power_peaks
    if (!peaks) continue
    const w = peaks[peakKey]
    if (w != null && w > 0 && (!best || w > best.w)) best = { a, w }
  }
  return best
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
      const kcal = list.reduce((s, a) => s + (aktivitaetKcal(a) ?? 0), 0)
      const powerRides = list.filter(
        (a) => leistungWatts(a) != null && a.moving_time_s >= MIN_POWER_RIDE_MIN * 60,
      )
      const avgWatts =
        powerRides.length > 0
          ? powerRides.reduce((s, a) => s + (leistungWatts(a) ?? 0), 0) / powerRides.length
          : null
      const wkgRides = powerRides
        .map((a) => wattProKg(leistungWatts(a), weightKg))
        .filter((v): v is number => v != null)
      const avgWkg = wkgRides.length > 0 ? wkgRides.reduce((s, v) => s + v, 0) / wkgRides.length : null
      return { year, rides: list.length, km: km / 1000, hours: hours / 3600, hm, kcal, avgWatts, avgWkg }
    })
}

export function berechneBestleistungen(
  activities: StravaActivityRow[],
  weightKg: number | null,
): StravaPersoenlicheBestleistung[] {
  const rides = activities.filter(istRadAktivitaet)
  if (rides.length === 0) return []

  const out: StravaPersoenlicheBestleistung[] = []

  const longest = bestAusListe(rides, (a) => a.distance_m)
  const longestTime = bestAusListe(rides, (a) => a.moving_time_s)
  const highest = bestAusListe(rides, (a) => a.elevation_gain_m)
  const mostKcal = bestAusListe(rides, (a) => aktivitaetKcal(a))
  const fastest = bestAusListe(
    rides.filter((a) => a.moving_time_s >= 30 * 60),
    (a) => aktivitaetSpeedKmh(a),
  )
  const steilst = bestAusListe(
    rides.filter((a) => a.distance_m >= 15_000 && (a.elevation_gain_m ?? 0) > 0),
    (a) => ((a.elevation_gain_m ?? 0) / a.distance_m) * 1000,
  )
  const bergetappe = bestAusListe(
    rides.filter((a) => (a.elevation_gain_m ?? 0) >= 800),
    (a) => a.distance_m,
  )
  const maxWattsSummary = bestAusListe(rides, (a) => a.max_watts)
  const maxHrRide = bestAusListe(
    rides.filter((a) => a.moving_time_s >= 20 * 60 && (a.average_heartrate ?? 0) > 0),
    (a) => a.average_heartrate,
  )

  if (longest) {
    out.push(pr('longest', 'distanz', 'Längste Fahrt (Distanz)', formatKm(longest.distance_m), longest))
  }
  if (longestTime) {
    out.push(
      pr(
        'longest_time',
        'distanz',
        'Längste Fahrt (Fahrzeit)',
        formatDauer(longestTime.moving_time_s),
        longestTime,
        `${formatKm(longestTime.distance_m)} · ${longestTime.name}`,
      ),
    )
  }
  if (fastest) {
    const spd = aktivitaetSpeedKmh(fastest)!
    out.push(
      pr(
        'fastest',
        'distanz',
        'Höchste Ø-Geschwindigkeit (≥30 min)',
        `${spd.toFixed(1)} km/h`,
        fastest,
      ),
    )
  }
  if (highest) {
    out.push(
      pr('elevation', 'hoehe', 'Meiste Höhenmeter', formatHm(highest.elevation_gain_m), highest),
    )
  }
  if (steilst) {
    const idx = ((steilst.elevation_gain_m ?? 0) / steilst.distance_m) * 1000
    out.push(
      pr(
        'steilst',
        'hoehe',
        'Steilste Etappe (hm/km, ≥15 km)',
        `${idx.toFixed(0)} hm/km`,
        steilst,
        `${formatHm(steilst.elevation_gain_m)} auf ${formatKm(steilst.distance_m)}`,
      ),
    )
  }
  if (bergetappe) {
    out.push(
      pr(
        'bergetappe',
        'hoehe',
        'Längste Bergetappe (≥800 hm)',
        formatKm(bergetappe.distance_m),
        bergetappe,
        `${formatHm(bergetappe.elevation_gain_m)} hm`,
      ),
    )
  }
  if (mostKcal) {
    out.push(
      pr('most_kcal', 'kalorien', 'Meiste Kalorien (eine Fahrt)', formatKcal(aktivitaetKcal(mostKcal)), mostKcal),
    )
  }
  if (maxWattsSummary?.max_watts) {
    out.push(
      pr(
        'max_watts',
        'leistung',
        'Höchster Watt-Peak (Strava)',
        `${Math.round(maxWattsSummary.max_watts)} W`,
        maxWattsSummary,
      ),
    )
  }
  if (maxHrRide?.average_heartrate) {
    out.push(
      pr(
        'max_hr',
        'puls',
        'Höchster Ø-Puls (≥20 min)',
        `${Math.round(maxHrRide.average_heartrate)} bpm`,
        maxHrRide,
        maxHrRide.max_heartrate ? `max ${Math.round(maxHrRide.max_heartrate)} bpm` : undefined,
      ),
    )
  }

  const peakKeys: (keyof StravaPowerPeaks)[] = [
    'max_1s',
    'avg_5s',
    'avg_1min',
    'avg_5min',
    'avg_20min',
    'avg_60min',
  ]
  for (const pk of peakKeys) {
    const hit = bestePowerPeakGlobal(rides, pk)
    if (!hit) continue
    out.push(
      pr(
        `peak_${pk}`,
        'leistung',
        `Beste Leistung ${POWER_PEAK_LABELS[pk]}`,
        `${Math.round(hit.w)} W`,
        hit.a,
      ),
    )
    const wkg = wattProKg(hit.w, weightKg)
    if (wkg != null) {
      out.push({
        key: `peak_${pk}_wkg`,
        kategorie: 'leistung',
        label: `Beste Leistung ${POWER_PEAK_LABELS[pk]} (W/kg)`,
        value: `${wkg.toFixed(2)} W/kg`,
        detail: hit.a.name,
        activityId: hit.a.strava_id,
        date: formatDate(hit.a.start_date),
      })
    }
  }

  const powerRides = rides.filter(
    (a) => leistungWatts(a) != null && a.moving_time_s >= 20 * 60,
  )
  const bestRideWatts = bestAusListe(powerRides, (a) => leistungWatts(a))
  if (bestRideWatts) {
    out.push(
      pr(
        'best_ride_watts',
        'leistung',
        'Beste Ø-Leistung ganze Fahrt (≥20 min)',
        `${Math.round(leistungWatts(bestRideWatts)!)} W`,
        bestRideWatts,
      ),
    )
    const wkg = wattProKg(leistungWatts(bestRideWatts), weightKg)
    if (wkg != null) {
      out.push({
        key: 'best_ride_wkg',
        kategorie: 'leistung',
        label: 'Beste Ø-Leistung ganze Fahrt (W/kg, ≥20 min)',
        value: `${wkg.toFixed(2)} W/kg`,
        detail: bestRideWatts.name,
        activityId: bestRideWatts.strava_id,
        date: formatDate(bestRideWatts.start_date),
      })
    }
  }

  const byYear = berechneJahresStatistik(rides, weightKg)
  const bestYearKm = byYear.length ? [...byYear].sort((a, b) => b.km - a.km)[0] : null
  const bestYearRides = byYear.length ? [...byYear].sort((a, b) => b.rides - a.rides)[0] : null
  const bestYearHm = byYear.length ? [...byYear].sort((a, b) => b.hm - a.hm)[0] : null
  const bestYearKcal = byYear.length ? [...byYear].sort((a, b) => b.kcal - a.kcal)[0] : null

  if (bestYearKm) {
    out.push({
      key: 'year_km',
      kategorie: 'jahr',
      label: 'Rekord-Jahr (Kilometer)',
      value: `${bestYearKm.km.toLocaleString('de-DE', { maximumFractionDigits: 0 })} km`,
      detail: `${bestYearKm.rides} Fahrten`,
      date: String(bestYearKm.year),
    })
  }
  if (bestYearHm) {
    out.push({
      key: 'year_hm',
      kategorie: 'jahr',
      label: 'Rekord-Jahr (Höhenmeter)',
      value: `${Math.round(bestYearHm.hm).toLocaleString('de-DE')} hm`,
      detail: `${bestYearHm.km.toLocaleString('de-DE', { maximumFractionDigits: 0 })} km`,
      date: String(bestYearHm.year),
    })
  }
  if (bestYearKcal && bestYearKcal.kcal > 0) {
    out.push({
      key: 'year_kcal',
      kategorie: 'jahr',
      label: 'Rekord-Jahr (Kalorien)',
      value: formatKcal(bestYearKcal.kcal),
      detail: `${bestYearKcal.rides} Fahrten`,
      date: String(bestYearKcal.year),
    })
  }
  if (bestYearRides) {
    out.push({
      key: 'year_rides',
      kategorie: 'jahr',
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
    (a) => istRadAktivitaet(a) && leistungWatts(a) != null && a.moving_time_s >= 20 * 60,
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
  const totalKcal = rides.reduce((s, a) => s + (aktivitaetKcal(a) ?? 0), 0)

  return {
    totalRides: rides.length,
    totalKm,
    totalHours,
    totalHm,
    totalKcal,
    jahre: berechneJahresStatistik(rides, weightKg),
    bestleistungen: berechneBestleistungen(rides, weightKg),
    wkgMonat: berechneWkgMonat(rides, weightKg),
    recent: [...rides].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date)).slice(0, 50),
  }
}

export { formatKm, formatHm, formatHours, formatDate, formatKcal }

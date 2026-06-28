/** Strava — Konsistenz, Streaks, Polarisation, Climbing, Vergleiche, Alerts. */

import { istRadAktivitaet, leistungWatts } from '@/lib/strava/strava-auswertung'
import { summiereHrZonen, schaetzeHrZonenAusAvg } from '@/lib/strava/strava-hr-zones'
import { geschaetztesTss } from '@/lib/strava/strava-training-load'
import type { StravaActivityRow, StravaHrZoneMinutes } from '@/lib/strava/strava-types'

export type ConsistencyStats = {
  currentStreakWeeks: number
  longestStreakWeeks: number
  weeksWithRide: number
  totalWeeks: number
  consistencyPct: number
}

export type IntensityMix = {
  easyMin: number
  moderateMin: number
  hardMin: number
  easyPct: number
  moderatePct: number
  hardPct: number
}

export type ClimbingWeek = {
  label: string
  hm: number
  km: number
  hmPerKm: number
}

export type YearCompare = {
  label: string
  current: number
  previous: number
  changePct: number | null
}

export type SmartAlert = {
  id: string
  level: 'info' | 'warn' | 'success'
  message: string
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}

function weekKey(d: Date): string {
  const ws = startOfWeek(d)
  return ws.toISOString().slice(0, 10)
}

export function berechneKonsistenz(activities: StravaActivityRow[], weeks = 52): ConsistencyStats {
  const rides = activities.filter(istRadAktivitaet)
  const now = new Date()
  const activeWeeks = new Set<string>()

  for (let i = 0; i < weeks; i++) {
    const ref = new Date(now)
    ref.setDate(ref.getDate() - i * 7)
    const ws = startOfWeek(ref)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    we.setHours(23, 59, 59, 999)
    const has = rides.some((a) => {
      const t = Date.parse(a.start_date)
      return t >= ws.getTime() && t <= we.getTime()
    })
    if (has) activeWeeks.add(weekKey(ref))
  }

  let currentStreak = 0
  for (let i = 0; i < weeks; i++) {
    const ref = new Date(now)
    ref.setDate(ref.getDate() - i * 7)
    if (activeWeeks.has(weekKey(ref))) currentStreak++
    else break
  }

  let longest = 0
  let run = 0
  for (let i = weeks - 1; i >= 0; i--) {
    const ref = new Date(now)
    ref.setDate(ref.getDate() - i * 7)
    if (activeWeeks.has(weekKey(ref))) {
      run++
      longest = Math.max(longest, run)
    } else run = 0
  }

  const weeksWithRide = activeWeeks.size
  return {
    currentStreakWeeks: currentStreak,
    longestStreakWeeks: longest,
    weeksWithRide,
    totalWeeks: weeks,
    consistencyPct: weeks > 0 ? (weeksWithRide / weeks) * 100 : 0,
  }
}

function zonenFuerAktivitaet(a: StravaActivityRow, maxHr: number): StravaHrZoneMinutes | null {
  if (a.hr_zone_minutes) return a.hr_zone_minutes
  if (a.average_heartrate != null && a.average_heartrate > 0 && maxHr > 0) {
    return schaetzeHrZonenAusAvg(a.average_heartrate, a.moving_time_s, maxHr)
  }
  return null
}

/** Polarisation: Easy Z1-2, Moderate Z3, Hard Z4-5 — oder Watt/FTP-Fallback. */
export function berechneIntensitaetsMix(
  activities: StravaActivityRow[],
  maxHr: number | null,
  ftp: number | null,
  tage = 28,
): IntensityMix {
  const cutoff = Date.now() - tage * 86_400_000
  const rides = activities.filter((a) => istRadAktivitaet(a) && Date.parse(a.start_date) >= cutoff)

  let easyMin = 0
  let moderateMin = 0
  let hardMin = 0

  if (maxHr != null && maxHr > 0 && rides.some((a) => a.average_heartrate || a.hr_zone_minutes)) {
    for (const a of rides) {
      const z = zonenFuerAktivitaet(a, maxHr)
      if (!z) continue
      easyMin += z.z1 + z.z2
      moderateMin += z.z3
      hardMin += z.z4 + z.z5
    }
  } else if (ftp != null && ftp > 0) {
    for (const a of rides) {
      const w = leistungWatts(a)
      const min = a.moving_time_s / 60
      if (w == null) {
        easyMin += min
        continue
      }
      const pct = w / ftp
      if (pct < 0.75) easyMin += min
      else if (pct < 0.9) moderateMin += min
      else hardMin += min
    }
  } else {
    for (const a of rides) easyMin += a.moving_time_s / 60
  }

  const total = easyMin + moderateMin + hardMin || 1
  return {
    easyMin,
    moderateMin,
    hardMin,
    easyPct: (easyMin / total) * 100,
    moderatePct: (moderateMin / total) * 100,
    hardPct: (hardMin / total) * 100,
  }
}

export function berechneKletterProfil(activities: StravaActivityRow[], weeks = 12): ClimbingWeek[] {
  const rides = activities.filter(istRadAktivitaet)
  const now = new Date()
  const out: ClimbingWeek[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const ref = new Date(now)
    ref.setDate(ref.getDate() - i * 7)
    const ws = startOfWeek(ref)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    we.setHours(23, 59, 59, 999)
    const week = rides.filter((a) => {
      const t = Date.parse(a.start_date)
      return t >= ws.getTime() && t <= we.getTime()
    })
    const hm = week.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)
    const km = week.reduce((s, a) => s + a.distance_m, 0) / 1000
    out.push({
      label: ws.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
      hm: Math.round(hm),
      km: Math.round(km * 10) / 10,
      hmPerKm: km > 0 ? Math.round((hm / km) * 10) / 10 : 0,
    })
  }
  return out
}

export function berechneJahresvergleich(activities: StravaActivityRow[], now = new Date()): YearCompare[] {
  const rides = activities.filter(istRadAktivitaet)
  const year = now.getFullYear()
  const prevYear = year - 1
  const weekNum = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000 + 1) / 7,
  )

  function ytd(y: number) {
    const from = new Date(y, 0, 1)
    const to = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59)
    const list = rides.filter((a) => {
      const d = new Date(a.start_date)
      return d >= from && d <= to
    })
    return {
      km: list.reduce((s, a) => s + a.distance_m, 0) / 1000,
      hm: list.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0),
      rides: list.length,
      hours: list.reduce((s, a) => s + a.moving_time_s, 0) / 3600,
    }
  }

  const cur = ytd(year)
  const prev = ytd(prevYear)

  const chg = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : null)

  return [
    { label: `km YTD vs. ${prevYear}`, current: Math.round(cur.km), previous: Math.round(prev.km), changePct: chg(cur.km, prev.km) },
    { label: `Hm YTD vs. ${prevYear}`, current: Math.round(cur.hm), previous: Math.round(prev.hm), changePct: chg(cur.hm, prev.hm) },
    { label: `Fahrten YTD (W${weekNum})`, current: cur.rides, previous: prev.rides, changePct: chg(cur.rides, prev.rides) },
    { label: 'Stunden YTD', current: Math.round(cur.hours * 10) / 10, previous: Math.round(prev.hours * 10) / 10, changePct: chg(cur.hours, prev.hours) },
  ]
}

export function berechneSmartAlerts(
  activities: StravaActivityRow[],
  opts: { ftp?: number | null; tsb?: number | null; consistency?: ConsistencyStats; mix?: IntensityMix },
): SmartAlert[] {
  const alerts: SmartAlert[] = []
  const rides = activities
    .filter(istRadAktivitaet)
    .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))
  const now = Date.now()
  const last14 = rides.filter((a) => now - Date.parse(a.start_date) <= 14 * 86_400_000)
  const last7Tss = last14
    .filter((a) => now - Date.parse(a.start_date) <= 7 * 86_400_000)
    .reduce((s, a) => s + geschaetztesTss(a, opts.ftp ?? null), 0)
  const prev7Tss = last14
    .filter((a) => {
      const age = now - Date.parse(a.start_date)
      return age > 7 * 86_400_000 && age <= 14 * 86_400_000
    })
    .reduce((s, a) => s + geschaetztesTss(a, opts.ftp ?? null), 0)

  if (prev7Tss > 0 && last7Tss > prev7Tss * 1.4) {
    alerts.push({
      id: 'load_spike',
      level: 'warn',
      message: `Belastung +${Math.round(((last7Tss - prev7Tss) / prev7Tss) * 100)} % vs. Vorwoche — erhöhtes Verletzungsrisiko.`,
    })
  }

  if (opts.tsb != null && opts.tsb < -20) {
    alerts.push({
      id: 'tsb_low',
      level: 'warn',
      message: `Form (TSB ${opts.tsb}) im roten Bereich — Regeneration empfohlen.`,
    })
  } else if (opts.tsb != null && opts.tsb > 10 && opts.tsb < 25) {
    alerts.push({
      id: 'tsb_good',
      level: 'success',
      message: `Form optimal (TSB ${opts.tsb}) — ideal für harte Einheiten oder Wettkampf.`,
    })
  }

  if (opts.consistency && opts.consistency.currentStreakWeeks >= 4) {
    alerts.push({
      id: 'streak',
      level: 'success',
      message: `${opts.consistency.currentStreakWeeks} Wochen in Folge trainiert — starke Konsistenz!`,
    })
  }

  const daysSince = rides.length
    ? Math.floor((now - Date.parse(rides[0].start_date)) / 86_400_000)
    : activities.length
      ? Math.floor(
          (now - Date.parse(
            [...activities].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))[0]
              .start_date,
          )) /
            86_400_000,
        )
      : 999
  if (daysSince >= 5) {
    alerts.push({
      id: 'rest',
      level: 'info',
      message:
        rides.length > 0
          ? `Letzte Rad-Fahrt vor ${daysSince} Tagen — Zeit für eine Einheit?`
          : `Letzte Aktivität vor ${daysSince} Tagen — keine Rad-Fahrten im Feed?`,
    })
  }

  if (opts.mix && opts.mix.hardPct > 35) {
    alerts.push({
      id: 'polarization',
      level: 'info',
      message: `${Math.round(opts.mix.hardPct)} % harte Intensität (28 Tage) — ggf. mehr Zone-2 ergänzen.`,
    })
  }

  const missingPower = rides.filter((a) => a.device_watts && !a.power_peaks).length
  if (missingPower > 5) {
    alerts.push({
      id: 'streams',
      level: 'info',
      message: `${missingPower} Fahrten ohne Power-Stream — „Sync" mehrfach ausführen für vollständige Kurve.`,
    })
  }

  return alerts
}

/** Aggregierte HF-Zonen aus gespeicherten Stream-Daten. */
export function aggregierteHrZonen(
  activities: StravaActivityRow[],
  maxHr: number,
  tage = 28,
): StravaHrZoneMinutes {
  const cutoff = Date.now() - tage * 86_400_000
  const zonen = activities
    .filter((a) => istRadAktivitaet(a) && Date.parse(a.start_date) >= cutoff)
    .map((a) => zonenFuerAktivitaet(a, maxHr))
    .filter((z): z is StravaHrZoneMinutes => z != null)
  return zonen.length > 0 ? summiereHrZonen(zonen) : { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
}

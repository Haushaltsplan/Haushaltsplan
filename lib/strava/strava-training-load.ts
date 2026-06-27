/** Strava — TSS-Schätzung & CTL/ATL/TSB (Training Load). */

import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type DailyLoad = {
  date: string
  tss: number
  hours: number
}

export type FormPoint = {
  date: string
  label: string
  ctl: number
  atl: number
  tsb: number
  tss: number
}

const CTL_TAU = 42
const ATL_TAU = 7

/** TSS aus Strava Suffer Score (0–∞, typisch 0–500+) normalisiert, oder Watt/FTP-Schätzung. */
export function geschaetztesTss(a: StravaActivityRow, ftp: number | null): number {
  if (a.estimated_tss != null && a.estimated_tss > 0) return a.estimated_tss
  if (a.suffer_score != null && a.suffer_score > 0) return a.suffer_score

  const hours = a.moving_time_s / 3600
  if (hours <= 0) return 0

  const np = a.weighted_avg_watts ?? a.average_watts
  if (np != null && np > 0 && ftp != null && ftp > 0) {
    const ifVal = np / ftp
    return Math.round(hours * ifVal * ifVal * 100)
  }

  if (a.average_heartrate != null && a.average_heartrate > 0) {
    const ifHr = Math.min(1.2, Math.max(0.4, (a.average_heartrate - 100) / 80))
    return Math.round(hours * ifHr * ifHr * 80)
  }

  return Math.round(hours * 40)
}

function isoDate(iso: string): string {
  return iso.slice(0, 10)
}

/** Tages-TSS aggregieren. */
export function tagesLastProTag(activities: StravaActivityRow[], ftp: number | null): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of activities.filter(istRadAktivitaet)) {
    const d = isoDate(a.start_date)
    map.set(d, (map.get(d) ?? 0) + geschaetztesTss(a, ftp))
  }
  return map
}

function ewma(prev: number, value: number, tau: number): number {
  const alpha = 1 - Math.exp(-1 / tau)
  return prev + alpha * (value - prev)
}

/** CTL/ATL/TSB-Verlauf der letzten N Tage. */
export function berechneFormVerlauf(
  activities: StravaActivityRow[],
  ftp: number | null,
  tage = 90,
  now = new Date(),
): FormPoint[] {
  const daily = tagesLastProTag(activities, ftp)
  const out: FormPoint[] = []
  let ctl = 0
  let atl = 0

  const start = new Date(now)
  start.setDate(start.getDate() - tage - 30)

  for (let i = 0; i <= tage + 30; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const tss = daily.get(key) ?? 0
    ctl = ewma(ctl, tss, CTL_TAU)
    atl = ewma(atl, tss, ATL_TAU)
    if (i >= 30) {
      out.push({
        date: key,
        label: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
        ctl: Math.round(ctl),
        atl: Math.round(atl),
        tsb: Math.round(ctl - atl),
        tss: Math.round(tss),
      })
    }
  }
  return out.slice(-tage)
}

export function aktuelleForm(activities: StravaActivityRow[], ftp: number | null): FormPoint | null {
  const verlauf = berechneFormVerlauf(activities, ftp, 14)
  return verlauf.length > 0 ? verlauf[verlauf.length - 1] : null
}

export function formLabel(tsb: number): { label: string; color: string } {
  if (tsb > 15) return { label: 'Frisch', color: '#4ade80' }
  if (tsb > 0) return { label: 'Optimal', color: '#22d3ee' }
  if (tsb > -15) return { label: 'Ermüdet', color: '#eab308' }
  return { label: 'Überlastet', color: '#f87171' }
}

/** Strava — Wetter zur Aktivitätszeit (Open-Meteo). */

import { decodePolyline } from '@/lib/strava/strava-polyline'
import { wetterOrtKoordinaten } from '@/lib/region-haarbach'

export type AktivitaetsWetter = {
  tempC: number
  windKmh: number | null
  weatherCode: number
}

const DEFAULT_HOME = wetterOrtKoordinaten('haarbach')

export function startpunktAusPolyline(polyline: string | null | undefined): { lat: number; lon: number } | null {
  if (!polyline?.trim()) return null
  try {
    const pts = decodePolyline(polyline.trim())
    if (!pts.length) return null
    const [lat, lon] = pts[0]
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}

export function fallbackWetterKoordinaten(
  polyline: string | null | undefined,
  home?: { lat: number | null; lon: number | null } | null,
): { lat: number; lon: number } {
  const start = startpunktAusPolyline(polyline)
  if (start) return start
  if (home?.lat != null && home?.lon != null && home.lat !== 0 && home.lon !== 0) {
    return { lat: home.lat, lon: home.lon }
  }
  const envLat = Number(process.env.STRAVA_WEATHER_LAT)
  const envLon = Number(process.env.STRAVA_WEATHER_LON)
  if (Number.isFinite(envLat) && Number.isFinite(envLon)) {
    return { lat: envLat, lon: envLon }
  }
  return { lat: DEFAULT_HOME.lat, lon: DEFAULT_HOME.lon }
}

function isoDatumUndStunde(startIso: string): { date: string; hour: number } | null {
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
  if (!y || !m || !day || !Number.isFinite(h)) return null
  return { date: `${y}-${m}-${day}`, hour: h }
}

async function fetchHourlyArchive(
  lat: number,
  lon: number,
  date: string,
): Promise<{ time: string[]; temp: number[]; wind: number[]; code: number[] } | null> {
  const u = new URL('https://archive-api.open-meteo.com/v1/archive')
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set('start_date', date)
  u.searchParams.set('end_date', date)
  u.searchParams.set('timezone', 'Europe/Berlin')
  u.searchParams.set('wind_speed_unit', 'kmh')
  u.searchParams.set('hourly', 'temperature_2m,weather_code,wind_speed_10m')

  const res = await fetch(u.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const j = (await res.json()) as {
    hourly?: {
      time?: string[]
      temperature_2m?: number[]
      weather_code?: number[]
      wind_speed_10m?: number[]
    }
  }
  const h = j.hourly
  if (!h?.time?.length) return null
  return {
    time: h.time,
    temp: h.temperature_2m ?? [],
    wind: h.wind_speed_10m ?? [],
    code: h.weather_code ?? [],
  }
}

async function fetchHourlyForecastPast(
  lat: number,
  lon: number,
  date: string,
): Promise<{ time: string[]; temp: number[]; wind: number[]; code: number[] } | null> {
  const u = new URL('https://api.open-meteo.com/v1/forecast')
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set('timezone', 'Europe/Berlin')
  u.searchParams.set('wind_speed_unit', 'kmh')
  u.searchParams.set('start_date', date)
  u.searchParams.set('end_date', date)
  u.searchParams.set('hourly', 'temperature_2m,weather_code,wind_speed_10m')

  const res = await fetch(u.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const j = (await res.json()) as {
    hourly?: {
      time?: string[]
      temperature_2m?: number[]
      weather_code?: number[]
      wind_speed_10m?: number[]
    }
  }
  const h = j.hourly
  if (!h?.time?.length) return null
  return {
    time: h.time,
    temp: h.temperature_2m ?? [],
    wind: h.wind_speed_10m ?? [],
    code: h.weather_code ?? [],
  }
}

function pickHourIndex(times: string[], targetHour: number): number {
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < times.length; i++) {
    const t = times[i]
    const h = Number(t.slice(11, 13))
    if (!Number.isFinite(h)) continue
    const diff = Math.abs(h - targetHour)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

/** Wetter zur Startzeit der Aktivität (Stunde, Europe/Berlin). */
export async function ladeWetterFuerAktivitaet(
  lat: number,
  lon: number,
  startIso: string,
): Promise<AktivitaetsWetter | null> {
  const parsed = isoDatumUndStunde(startIso)
  if (!parsed) return null

  const daysAgo = (Date.now() - Date.parse(startIso)) / 86400_000
  let hourly =
    daysAgo > 5
      ? await fetchHourlyArchive(lat, lon, parsed.date)
      : await fetchHourlyForecastPast(lat, lon, parsed.date)
  if (!hourly) hourly = await fetchHourlyArchive(lat, lon, parsed.date)
  if (!hourly) hourly = await fetchHourlyForecastPast(lat, lon, parsed.date)
  if (!hourly) return null

  const idx = pickHourIndex(hourly.time, parsed.hour)
  const temp = hourly.temp[idx]
  if (temp == null || !Number.isFinite(temp)) return null

  return {
    tempC: Math.round(temp * 10) / 10,
    windKmh: hourly.wind[idx] != null ? Math.round(Number(hourly.wind[idx])) : null,
    weatherCode: Number.isFinite(hourly.code[idx]) ? Number(hourly.code[idx]) : 0,
  }
}

const WMO_DE: Record<number, string> = {
  0: 'Klar',
  1: 'Meist klar',
  2: 'Teilweise bewölkt',
  3: 'Bewölkt',
  45: 'Nebel',
  48: 'Nebel',
  51: 'Nieselregen',
  53: 'Nieselregen',
  55: 'Nieselregen',
  61: 'Regen',
  63: 'Regen',
  65: 'Starkregen',
  71: 'Schnee',
  80: 'Regenschauer',
  95: 'Gewitter',
}

export function wetterCodeDe(code: number | null | undefined): string {
  if (code == null) return '—'
  return WMO_DE[code] ?? 'Wechselhaft'
}

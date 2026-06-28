/** Strava — Token, API & Sync (nur Server). */

import {
  berechneHrZonenAusStream,
  parseHrZoneMinutes,
} from '@/lib/strava/strava-hr-zones'
import {
  berechnePowerPeaksAusStream,
  geschwindigkeitKmh,
  kilojoulesZuKcal,
  parsePowerPeaks,
} from '@/lib/strava/strava-power'
import {
  berechneAerobicDecoupling,
  berechneVariabilityIndex,
} from '@/lib/strava/strava-advanced-metrics'
import {
  leseStravaTokensDb,
  loescheStravaTokensDb,
  leseStravaTokensAdmin,
  listeStravaTokenUserIds,
  speichereStravaTokensAdmin,
  speichereStravaTokensDb,
} from '@/lib/strava/strava-oauth-store'
import { geschaetztesTss } from '@/lib/strava/strava-training-load'
import {
  fallbackWetterKoordinaten,
  ladeWetterFuerAktivitaet,
} from '@/lib/strava/strava-weather'
import type { StravaSegmentEffortRow } from '@/lib/strava/strava-segments'
import { baueBackfillStatus, type BackfillStatus } from '@/lib/strava/strava-backfill-status'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  STRAVA_SCOPES,
  stravaApiKonfiguriert,
  stravaRedirectUri,
  type StravaActivityRow,
  type StravaAthleteProfile,
  type StravaStoredTokens,
} from '@/lib/strava/strava-types'
import type { SupabaseClient } from '@supabase/supabase-js'

const STREAM_PAUSE_MS = 280
const MAX_STREAMS_PRO_SYNC = 25
const MAX_WEATHER_PRO_SYNC = 10
const WEATHER_PAUSE_MS = 350
const MAX_SEGMENTS_PRO_SYNC = 15
const SEGMENT_PAUSE_MS = 320

const AUTH_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL = 'https://www.strava.com/oauth/token'
const API_BASE = 'https://www.strava.com/api/v3'

type StravaApiActivity = {
  id: number
  name?: string
  sport_type?: string
  type?: string
  start_date: string
  distance?: number
  moving_time?: number
  elapsed_time?: number
  total_elevation_gain?: number
  average_watts?: number
  weighted_average_watts?: number
  max_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  kilojoules?: number
  average_speed?: number
  device_watts?: boolean
  calories?: number
  suffer_score?: number
  gear_id?: number
  workout_type?: number
  map?: { summary_polyline?: string }
}

type StravaApiSegmentEffort = {
  id?: number
  elapsed_time?: number
  distance?: number
  average_watts?: number
  max_watts?: number
  average_heartrate?: number
  pr_rank?: number
  kom_rank?: number
  segment?: {
    id?: number
    name?: string
    distance?: number
    average_grade?: number
  }
}

type StravaApiActivityDetail = StravaApiActivity & {
  segment_efforts?: StravaApiSegmentEffort[]
}

type StravaApiAthlete = {
  id?: number
  firstname?: string
  lastname?: string
  weight?: number
  ftp?: number
  max_heartrate?: number
}

function clientConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim()
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID oder STRAVA_CLIENT_SECRET fehlt in .env.local')
  }
  return { clientId, clientSecret }
}

export { stravaApiKonfiguriert }

export function baueStravaAuthUrl(origin: string, state: string): string {
  const { clientId } = clientConfig()
  const url = new URL(AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', stravaRedirectUri(origin))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', STRAVA_SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

async function tauscheCode(code: string, redirectUri: string): Promise<StravaStoredTokens & { athleteId: number | null }> {
  const { clientId, clientSecret } = clientConfig()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava Token-Austausch fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
    athlete?: { id?: number }
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: data.expires_at * 1000 - 60_000,
    athleteId: data.athlete?.id ?? null,
  }
}

async function refreshTokens(refreshToken: string): Promise<StravaStoredTokens> {
  const { clientId, clientSecret } = clientConfig()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava Token-Refresh fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: data.expires_at * 1000 - 60_000,
  }
}

export async function tauscheAuthCode(code: string, origin: string, ownerUserId: string): Promise<void> {
  const tokens = await tauscheCode(code, stravaRedirectUri(origin))
  await speichereStravaTokensAdmin(ownerUserId, tokens)
  const meta = await ladeStravaAthleteMeta(tokens.accessToken)
  const sbAdmin = (await import('@/lib/supabase-admin')).createSupabaseAdmin()
  await aktualisiereAthleteMetaVonStrava(sbAdmin as unknown as SupabaseClient, meta, ownerUserId)
}

export async function holeGueltigenAccessToken(sb: SupabaseClient | null): Promise<string | null> {
  if (!sb) return null
  const stored = await leseStravaTokensDb(sb)
  if (!stored) return null
  if (stored.expiresAtMs > Date.now()) return stored.accessToken
  try {
    const fresh = await refreshTokens(stored.refreshToken)
    const merged = { ...fresh, athleteId: stored.athleteId }
    await speichereStravaTokensDb(sb, merged)
    return fresh.accessToken
  } catch {
    await loescheStravaTokensDb(sb)
    return null
  }
}

async function stravaGet<T>(token: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava API ${path} (${res.status}): ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function mapActivity(a: StravaApiActivity): StravaActivityRow {
  const distance_m = Number(a.distance) || 0
  const moving_time_s = Number(a.moving_time) || 0
  const kj = a.kilojoules != null ? Number(a.kilojoules) : null
  const kcalFromApi = a.calories != null && a.calories > 0 ? Number(a.calories) : null
  const speedFromApi =
    a.average_speed != null && a.average_speed > 0 ? Number(a.average_speed) * 3.6 : null
  const row: StravaActivityRow = {
    strava_id: a.id,
    name: a.name?.trim() || 'Fahrt',
    sport_type: a.sport_type || a.type || 'Ride',
    type: a.type ?? null,
    start_date: a.start_date,
    distance_m,
    moving_time_s,
    elapsed_time_s: a.elapsed_time != null ? Number(a.elapsed_time) : null,
    elevation_gain_m: a.total_elevation_gain != null ? Number(a.total_elevation_gain) : null,
    average_watts: a.average_watts != null ? Number(a.average_watts) : null,
    weighted_avg_watts: a.weighted_average_watts != null ? Number(a.weighted_average_watts) : null,
    max_watts: a.max_watts != null ? Number(a.max_watts) : null,
    average_heartrate: a.average_heartrate != null ? Number(a.average_heartrate) : null,
    max_heartrate: a.max_heartrate != null ? Number(a.max_heartrate) : null,
    kilojoules: kj,
    calories_kcal: kcalFromApi ?? kilojoulesZuKcal(kj),
    average_speed_kmh: speedFromApi ?? geschwindigkeitKmh(distance_m, moving_time_s),
    device_watts: a.device_watts ?? null,
    power_peaks: null,
    summary_polyline: a.map?.summary_polyline?.trim() || null,
    suffer_score: a.suffer_score != null && a.suffer_score > 0 ? Number(a.suffer_score) : null,
    gear_id: a.gear_id != null ? Number(a.gear_id) : null,
    workout_type: a.workout_type != null ? Number(a.workout_type) : null,
    hr_zone_minutes: null,
    estimated_tss: null,
  }
  row.estimated_tss = geschaetztesTss(row, null)
  return row
}

async function ladeStravaAthleteMeta(token: string): Promise<{
  athleteId?: number
  ftp: number | null
  max_hr: number | null
  firstname: string | null
  lastname: string | null
}> {
  const a = await stravaGet<StravaApiAthlete>(token, '/athlete')
  return {
    athleteId: a.id,
    ftp: a.ftp != null && a.ftp > 0 ? a.ftp : null,
    max_hr: a.max_heartrate != null && a.max_heartrate > 0 ? Math.round(a.max_heartrate) : null,
    firstname: a.firstname?.trim() || null,
    lastname: a.lastname?.trim() || null,
  }
}

/** Strava-Metadaten — überschreibt niemals omnia_weight_kg. */
async function aktualisiereAthleteMetaVonStrava(
  sb: SupabaseClient,
  meta: Awaited<ReturnType<typeof ladeStravaAthleteMeta>>,
  ownerUserId?: string,
): Promise<void> {
  let uid = ownerUserId
  if (!uid) {
    const {
      data: { user },
    } = await sb.auth.getUser()
    uid = user?.id
  }
  if (!uid) return
  const payload = {
    ftp: meta.ftp,
    max_hr: meta.max_hr,
    firstname: meta.firstname,
    lastname: meta.lastname,
    updated_at: new Date().toISOString(),
  }
  const { data: existing } = await sb
    .from('strava_athlete_profile')
    .select('owner_user_id')
    .eq('owner_user_id', uid)
    .maybeSingle()
  if (existing) {
    await sb.from('strava_athlete_profile').update(payload).eq('owner_user_id', uid)
  } else {
    await sb.from('strava_athlete_profile').insert({ owner_user_id: uid, ...payload })
  }
}

export async function leseAthleteProfilDb(sb: SupabaseClient): Promise<StravaAthleteProfile | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  return leseAthleteProfilFuerOwner(sb, user.id)
}

export async function leseAthleteProfilFuerOwner(
  sb: SupabaseClient,
  ownerUserId: string,
): Promise<StravaAthleteProfile | null> {
  const { data } = await sb
    .from('strava_athlete_profile')
    .select(
      'omnia_weight_kg, weight_kg, ftp, max_hr, firstname, lastname, goal_km_year, goal_hm_year, goal_rides_per_week, goal_tss_week, goal_event_name, goal_event_date, weather_home_lat, weather_home_lon',
    )
    .eq('owner_user_id', ownerUserId)
    .maybeSingle()
  if (!data) return null
  const omnia =
    data.omnia_weight_kg != null
      ? Number(data.omnia_weight_kg)
      : data.weight_kg != null
        ? Number(data.weight_kg)
        : null
  return {
    omnia_weight_kg: omnia != null && omnia > 0 ? omnia : null,
    ftp: data.ftp != null ? Number(data.ftp) : null,
    max_hr: data.max_hr != null ? Number(data.max_hr) : null,
    firstname: data.firstname,
    lastname: data.lastname,
    goal_km_year: data.goal_km_year != null ? Number(data.goal_km_year) : null,
    goal_hm_year: data.goal_hm_year != null ? Number(data.goal_hm_year) : null,
    goal_rides_per_week: data.goal_rides_per_week != null ? Number(data.goal_rides_per_week) : null,
    goal_tss_week: data.goal_tss_week != null ? Number(data.goal_tss_week) : null,
    goal_event_name: data.goal_event_name,
    goal_event_date: data.goal_event_date,
    weather_home_lat: data.weather_home_lat != null ? Number(data.weather_home_lat) : null,
    weather_home_lon: data.weather_home_lon != null ? Number(data.weather_home_lon) : null,
  }
}

export async function speichereOmniaGewicht(sb: SupabaseClient, kg: number | null): Promise<void> {
  const weight = kg != null && kg > 0 && kg < 300 ? kg : null
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')
  const { data: existing } = await sb
    .from('strava_athlete_profile')
    .select('owner_user_id')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (existing) {
    const { error } = await sb
      .from('strava_athlete_profile')
      .update({ omnia_weight_kg: weight, updated_at: new Date().toISOString() })
      .eq('owner_user_id', user.id)
    if (error) throw new Error(`Gewicht speichern: ${error.message}`)
  } else {
    const { error } = await sb.from('strava_athlete_profile').insert({
      owner_user_id: user.id,
      omnia_weight_kg: weight,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`Gewicht speichern: ${error.message}`)
  }
}

export function effektivesGewichtKg(profil: StravaAthleteProfile | null): number | null {
  return profil?.omnia_weight_kg ?? null
}

export async function speichereSaisonZiele(
  sb: SupabaseClient,
  goals: {
    goal_km_year?: number | null
    goal_hm_year?: number | null
    goal_rides_per_week?: number | null
    goal_tss_week?: number | null
    goal_event_name?: string | null
    goal_event_date?: string | null
    weather_home_lat?: number | null
    weather_home_lon?: number | null
  },
): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')

  const payload = {
    goal_km_year: goals.goal_km_year ?? null,
    goal_hm_year: goals.goal_hm_year ?? null,
    goal_rides_per_week: goals.goal_rides_per_week ?? null,
    goal_tss_week: goals.goal_tss_week ?? null,
    goal_event_name: goals.goal_event_name?.trim() || null,
    goal_event_date: goals.goal_event_date || null,
    updated_at: new Date().toISOString(),
  }

  if ('weather_home_lat' in goals || 'weather_home_lon' in goals) {
    Object.assign(payload, {
      weather_home_lat: goals.weather_home_lat ?? null,
      weather_home_lon: goals.weather_home_lon ?? null,
    })
  }

  const { data: existing } = await sb
    .from('strava_athlete_profile')
    .select('owner_user_id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error } = await sb.from('strava_athlete_profile').update(payload).eq('owner_user_id', user.id)
    if (error) throw new Error(`Ziele speichern: ${error.message}`)
  } else {
    const { error } = await sb.from('strava_athlete_profile').insert({ owner_user_id: user.id, ...payload })
    if (error) throw new Error(`Ziele speichern: ${error.message}`)
  }
}

type StreamBundle = {
  watts?: { data?: number[] }
  heartrate?: { data?: number[] }
  time?: { data?: number[] }
}

async function ladeActivityStreams(token: string, stravaId: number): Promise<StreamBundle | null> {
  try {
    return await stravaGet<StreamBundle>(token, `/activities/${stravaId}/streams`, {
      keys: 'watts,heartrate,time',
      key_by_type: 'true',
    })
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function speichereWetterHeimat(
  sb: SupabaseClient,
  lat: number | null,
  lon: number | null,
): Promise<void> {
  await speichereSaisonZiele(sb, { weather_home_lat: lat, weather_home_lon: lon })
}

async function synchronisiereActivityStreams(
  sb: SupabaseClient,
  token: string,
  ownerUserId: string,
  maxHr: number | null,
): Promise<number> {
  const { data: kandidaten } = await sb
    .from('strava_activities')
    .select(
      'strava_id, average_heartrate, device_watts, average_watts, max_watts, weighted_avg_watts, moving_time_s, aerobic_decoupling_pct',
    )
    .eq('owner_user_id', ownerUserId)
    .or('power_peaks.is.null,hr_zone_minutes.is.null,aerobic_decoupling_pct.is.null')
    .order('start_date', { ascending: false })
    .limit(MAX_STREAMS_PRO_SYNC)

  if (!kandidaten?.length) return 0

  let count = 0
  for (const row of kandidaten) {
    const stravaId = Number(row.strava_id)
    const stream = await ladeActivityStreams(token, stravaId)
    await sleep(STREAM_PAUSE_MS)

    const watts = stream?.watts?.data ?? []
    const hr = stream?.heartrate?.data ?? []
    const time = stream?.time?.data ?? []

    const peaks =
      watts.length > 0 && time.length === watts.length
        ? berechnePowerPeaksAusStream(watts, time)
        : null
    const hasPeaks = peaks && Object.values(peaks).some((v) => v != null)

    let hrZones = null
    if (hr.length > 0 && time.length === hr.length && maxHr != null && maxHr > 0) {
      hrZones = berechneHrZonenAusStream(hr, time, maxHr)
    }

    const update: Record<string, unknown> = {}
    if (hasPeaks) update.power_peaks = peaks
    else if (row.device_watts || row.average_watts || row.max_watts) update.power_peaks = {}
    if (hrZones) update.hr_zone_minutes = hrZones
    else if (row.average_heartrate && maxHr) update.hr_zone_minutes = {}

    const dec =
      watts.length > 0 && hr.length === watts.length && Number(row.moving_time_s) >= 45 * 60
        ? berechneAerobicDecoupling(watts, hr, time)
        : null
    if (dec != null) update.aerobic_decoupling_pct = dec

    const vi = berechneVariabilityIndex(
      row.weighted_avg_watts != null ? Number(row.weighted_avg_watts) : null,
      row.average_watts != null ? Number(row.average_watts) : null,
    )
    if (vi != null) update.variability_index = vi

    if (Object.keys(update).length === 0) continue

    const { error } = await sb
      .from('strava_activities')
      .update(update)
      .eq('owner_user_id', ownerUserId)
      .eq('strava_id', stravaId)
    if (!error) count += 1
  }
  return count
}

async function synchronisiereWetter(
  sb: SupabaseClient,
  ownerUserId: string,
  profil: StravaAthleteProfile | null,
): Promise<number> {
  const home = {
    lat: profil?.weather_home_lat ?? null,
    lon: profil?.weather_home_lon ?? null,
  }

  const { data: kandidaten } = await sb
    .from('strava_activities')
    .select('strava_id, start_date, summary_polyline')
    .eq('owner_user_id', ownerUserId)
    .is('weather_temp_c', null)
    .order('start_date', { ascending: false })
    .limit(MAX_WEATHER_PRO_SYNC)

  if (!kandidaten?.length) return 0

  let count = 0
  for (const row of kandidaten) {
    const coords = fallbackWetterKoordinaten(
      row.summary_polyline ? String(row.summary_polyline) : null,
      home,
    )
    const wetter = await ladeWetterFuerAktivitaet(coords.lat, coords.lon, String(row.start_date))
    await sleep(WEATHER_PAUSE_MS)
    if (!wetter) continue

    const { error } = await sb
      .from('strava_activities')
      .update({
        weather_temp_c: wetter.tempC,
        weather_wind_kmh: wetter.windKmh,
        weather_code: wetter.weatherCode,
        weather_lat: coords.lat,
        weather_lon: coords.lon,
      })
      .eq('owner_user_id', ownerUserId)
      .eq('strava_id', row.strava_id)

    if (!error) count += 1
  }
  return count
}

async function synchronisiereSegmentEfforts(
  sb: SupabaseClient,
  token: string,
  ownerUserId: string,
): Promise<number> {
  const { data: kandidaten } = await sb
    .from('strava_activities')
    .select('strava_id, start_date')
    .eq('owner_user_id', ownerUserId)
    .is('segments_synced_at', null)
    .order('start_date', { ascending: false })
    .limit(MAX_SEGMENTS_PRO_SYNC)

  if (!kandidaten?.length) return 0

  let count = 0
  for (const row of kandidaten) {
    const stravaId = Number(row.strava_id)
    let detail: StravaApiActivityDetail
    try {
      detail = await stravaGet<StravaApiActivityDetail>(token, `/activities/${stravaId}`)
    } catch {
      await sleep(SEGMENT_PAUSE_MS)
      continue
    }
    await sleep(SEGMENT_PAUSE_MS)

    const efforts = detail.segment_efforts ?? []
    const startDate = String(row.start_date || detail.start_date)

    if (efforts.length > 0) {
      const rows = efforts
        .filter((e) => e.segment?.id)
        .map((e) => ({
          owner_user_id: ownerUserId,
          strava_activity_id: stravaId,
          segment_id: Number(e.segment!.id),
          segment_name: String(e.segment!.name || 'Segment'),
          elapsed_time_s: e.elapsed_time != null ? Math.round(e.elapsed_time) : null,
          distance_m: e.distance ?? e.segment?.distance ?? null,
          average_grade: e.segment?.average_grade ?? null,
          average_watts: e.average_watts != null && e.average_watts > 0 ? e.average_watts : null,
          max_watts: e.max_watts != null && e.max_watts > 0 ? e.max_watts : null,
          average_heartrate:
            e.average_heartrate != null && e.average_heartrate > 0 ? e.average_heartrate : null,
          activity_start_date: startDate,
          pr_rank: e.pr_rank != null ? Math.round(e.pr_rank) : null,
          kom_rank: e.kom_rank != null ? Math.round(e.kom_rank) : null,
          synced_at: new Date().toISOString(),
        }))

      if (rows.length > 0) {
        await sb.from('strava_segment_efforts').upsert(rows, {
          onConflict: 'owner_user_id,strava_activity_id,segment_id',
        })
      }
    }

    await sb
      .from('strava_activities')
      .update({ segments_synced_at: new Date().toISOString() })
      .eq('owner_user_id', ownerUserId)
      .eq('strava_id', stravaId)

    count += 1
  }
  return count
}

async function neuestesAktivitaetsDatumFuerOwner(
  sb: SupabaseClient,
  ownerUserId: string,
): Promise<number | null> {
  const { data } = await sb
    .from('strava_activities')
    .select('start_date')
    .eq('owner_user_id', ownerUserId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.start_date) return null
  return Math.floor(Date.parse(String(data.start_date)) / 1000) - 86400 * 14
}

async function neuestesAktivitaetsDatum(sb: SupabaseClient): Promise<number | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  return neuestesAktivitaetsDatumFuerOwner(sb, user.id)
}

async function holeGueltigenAccessTokenAdmin(ownerUserId: string): Promise<string | null> {
  const stored = await leseStravaTokensAdmin(ownerUserId)
  if (!stored) return null
  if (stored.expiresAtMs > Date.now()) return stored.accessToken
  try {
    const fresh = await refreshTokens(stored.refreshToken)
    const merged = { ...fresh, athleteId: stored.athleteId }
    await speichereStravaTokensAdmin(ownerUserId, merged)
    return fresh.accessToken
  } catch {
    const admin = createSupabaseAdmin()
    await admin.from('strava_oauth_tokens').delete().eq('owner_user_id', ownerUserId)
    return null
  }
}

export async function synchronisiereStravaAktivitaeten(
  sb: SupabaseClient,
  opts: { maxPages?: number; fullImport?: boolean } = {},
): Promise<{ imported: number; total: number; streamsAnalysiert: number; wetterAngereichert: number; segmenteGeladen: number }> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')
  const token = await holeGueltigenAccessToken(sb)
  if (!token) throw new Error('Keine Strava-Verbindung.')
  return synchronisiereStravaIntern(sb, user.id, token, opts)
}

export async function synchronisiereStravaFuerOwner(
  ownerUserId: string,
  opts: { maxPages?: number; fullImport?: boolean } = {},
): Promise<{ imported: number; total: number; streamsAnalysiert: number; wetterAngereichert: number } | null> {
  const token = await holeGueltigenAccessTokenAdmin(ownerUserId)
  if (!token) return null
  const admin = createSupabaseAdmin()
  return synchronisiereStravaIntern(admin, ownerUserId, token, opts)
}

export async function synchronisiereAlleStravaCron(): Promise<{
  nutzer: number
  erfolgreich: number
  fehler: string[]
}> {
  const ids = await listeStravaTokenUserIds()
  const fehler: string[] = []
  let erfolgreich = 0
  for (const id of ids) {
    try {
      const r = await synchronisiereStravaFuerOwner(id, { maxPages: 5 })
      if (r) erfolgreich += 1
    } catch (e) {
      fehler.push(`${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { nutzer: ids.length, erfolgreich, fehler }
}

async function synchronisiereStravaIntern(
  sb: SupabaseClient,
  ownerUserId: string,
  token: string,
  opts: { maxPages?: number; fullImport?: boolean; nurAnalyse?: boolean } = {},
): Promise<{ imported: number; total: number; streamsAnalysiert: number; wetterAngereichert: number; segmenteGeladen: number }> {
  const maxPages = opts.maxPages ?? 60
  const meta = await ladeStravaAthleteMeta(token)
  await aktualisiereAthleteMetaVonStrava(sb, meta, ownerUserId)

  const profil = await leseAthleteProfilFuerOwner(sb, ownerUserId)
  const ftp = profil?.ftp ?? meta.ftp ?? null
  const all: StravaActivityRow[] = []

  if (!opts.nurAnalyse) {
    const after = opts.fullImport ? null : await neuestesAktivitaetsDatumFuerOwner(sb, ownerUserId)

    for (let page = 1; page <= maxPages; page++) {
      const params: Record<string, string> = { page: String(page), per_page: '200' }
      if (after != null) params.after = String(after)
      const batch = await stravaGet<StravaApiActivity[]>(token, '/athlete/activities', params)
      if (!Array.isArray(batch) || batch.length === 0) break
      all.push(...batch.map(mapActivity))
      if (batch.length < 200) break
    }

    if (all.length > 0) {
      const rows = all.map((a) => ({
        owner_user_id: ownerUserId,
        strava_id: a.strava_id,
        name: a.name,
        sport_type: a.sport_type,
        type: a.type,
        start_date: a.start_date,
        distance_m: a.distance_m,
        moving_time_s: a.moving_time_s,
        elapsed_time_s: a.elapsed_time_s,
        elevation_gain_m: a.elevation_gain_m,
        average_watts: a.average_watts,
        weighted_avg_watts: a.weighted_avg_watts,
        max_watts: a.max_watts,
        average_heartrate: a.average_heartrate,
        max_heartrate: a.max_heartrate,
        kilojoules: a.kilojoules,
        calories_kcal: a.calories_kcal,
        average_speed_kmh: a.average_speed_kmh,
        device_watts: a.device_watts,
        summary_polyline: a.summary_polyline,
        suffer_score: a.suffer_score,
        gear_id: a.gear_id,
        workout_type: a.workout_type,
        estimated_tss: geschaetztesTss(a, ftp),
        variability_index: berechneVariabilityIndex(a.weighted_avg_watts, a.average_watts),
        synced_at: new Date().toISOString(),
      }))
      const { error } = await sb.from('strava_activities').upsert(rows, {
        onConflict: 'owner_user_id,strava_id',
      })
      if (error) throw new Error(`Strava-Aktivitäten speichern: ${error.message}`)
    }
  }

  const maxHr = profil?.max_hr ?? meta.max_hr
  const streamsAnalysiert = await synchronisiereActivityStreams(sb, token, ownerUserId, maxHr)
  const wetterAngereichert = await synchronisiereWetter(sb, ownerUserId, profil)
  const segmenteGeladen = await synchronisiereSegmentEfforts(sb, token, ownerUserId)

  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId)

  return { imported: all.length, total: count ?? 0, streamsAnalysiert, wetterAngereichert, segmenteGeladen }
}

export async function ladeGespeicherteAktivitaeten(sb: SupabaseClient): Promise<StravaActivityRow[]> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return []

  const { data, error } = await sb
    .from('strava_activities')
    .select(
      'strava_id, name, sport_type, type, start_date, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_watts, weighted_avg_watts, max_watts, average_heartrate, max_heartrate, kilojoules, calories_kcal, average_speed_kmh, device_watts, power_peaks, summary_polyline, suffer_score, gear_id, workout_type, hr_zone_minutes, estimated_tss, weather_temp_c, weather_wind_kmh, weather_code, weather_lat, weather_lon, aerobic_decoupling_pct, variability_index',
    )
    .eq('owner_user_id', user.id)
    .order('start_date', { ascending: false })

  if (error || !data) return []
  return data.map((r) => ({
    strava_id: Number(r.strava_id),
    name: String(r.name || ''),
    sport_type: String(r.sport_type || 'Ride'),
    type: r.type,
    start_date: String(r.start_date),
    distance_m: Number(r.distance_m) || 0,
    moving_time_s: Number(r.moving_time_s) || 0,
    elapsed_time_s: r.elapsed_time_s != null ? Number(r.elapsed_time_s) : null,
    elevation_gain_m: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : null,
    average_watts: r.average_watts != null ? Number(r.average_watts) : null,
    weighted_avg_watts: r.weighted_avg_watts != null ? Number(r.weighted_avg_watts) : null,
    max_watts: r.max_watts != null ? Number(r.max_watts) : null,
    average_heartrate: r.average_heartrate != null ? Number(r.average_heartrate) : null,
    max_heartrate: r.max_heartrate != null ? Number(r.max_heartrate) : null,
    kilojoules: r.kilojoules != null ? Number(r.kilojoules) : null,
    calories_kcal: r.calories_kcal != null ? Number(r.calories_kcal) : null,
    average_speed_kmh: r.average_speed_kmh != null ? Number(r.average_speed_kmh) : null,
    device_watts: r.device_watts != null ? Boolean(r.device_watts) : null,
    power_peaks: parsePowerPeaks(r.power_peaks),
    summary_polyline: r.summary_polyline ? String(r.summary_polyline) : null,
    suffer_score: r.suffer_score != null ? Number(r.suffer_score) : null,
    gear_id: r.gear_id != null ? Number(r.gear_id) : null,
    workout_type: r.workout_type != null ? Number(r.workout_type) : null,
    hr_zone_minutes: parseHrZoneMinutes(r.hr_zone_minutes),
    estimated_tss: r.estimated_tss != null ? Number(r.estimated_tss) : null,
    weather_temp_c: r.weather_temp_c != null ? Number(r.weather_temp_c) : null,
    weather_wind_kmh: r.weather_wind_kmh != null ? Number(r.weather_wind_kmh) : null,
    weather_code: r.weather_code != null ? Number(r.weather_code) : null,
    weather_lat: r.weather_lat != null ? Number(r.weather_lat) : null,
    weather_lon: r.weather_lon != null ? Number(r.weather_lon) : null,
    aerobic_decoupling_pct:
      r.aerobic_decoupling_pct != null ? Number(r.aerobic_decoupling_pct) : null,
    variability_index: r.variability_index != null ? Number(r.variability_index) : null,
  }))
}

export async function ladeSegmentEfforts(sb: SupabaseClient): Promise<StravaSegmentEffortRow[]> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return []

  const { data, error } = await sb
    .from('strava_segment_efforts')
    .select(
      'strava_activity_id, segment_id, segment_name, elapsed_time_s, distance_m, average_grade, average_watts, max_watts, average_heartrate, activity_start_date, pr_rank, kom_rank',
    )
    .eq('owner_user_id', user.id)
    .order('activity_start_date', { ascending: false })

  if (error || !data) return []
  return data.map((r) => ({
    strava_activity_id: Number(r.strava_activity_id),
    segment_id: Number(r.segment_id),
    segment_name: String(r.segment_name || ''),
    elapsed_time_s: r.elapsed_time_s != null ? Number(r.elapsed_time_s) : null,
    distance_m: r.distance_m != null ? Number(r.distance_m) : null,
    average_grade: r.average_grade != null ? Number(r.average_grade) : null,
    average_watts: r.average_watts != null ? Number(r.average_watts) : null,
    max_watts: r.max_watts != null ? Number(r.max_watts) : null,
    average_heartrate: r.average_heartrate != null ? Number(r.average_heartrate) : null,
    activity_start_date: String(r.activity_start_date),
    pr_rank: r.pr_rank != null ? Number(r.pr_rank) : null,
    kom_rank: r.kom_rank != null ? Number(r.kom_rank) : null,
  }))
}

export async function zaehleSegmentBacklog(sb: SupabaseClient): Promise<number> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return 0
  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .is('segments_synced_at', null)
  return count ?? 0
}

async function zaehleBackfillFuerOwner(sb: SupabaseClient, ownerUserId: string) {
  const base = () => sb.from('strava_activities').select('*', { count: 'exact', head: true }).eq('owner_user_id', ownerUserId)

  /** Nur Fahrten mit Powermeter oder HR — wie Stream-Sync-Kandidaten */
  const mitSensor = () =>
    base().or('device_watts.eq.true,average_watts.not.is.null,average_heartrate.not.is.null')

  const [
    { count: activityTotal },
    { count: streamsPending },
    { count: streamsEligible },
    { count: weatherPending },
    { count: segmentsPending },
    { count: decouplingPending },
    { count: decouplingEligible },
  ] = await Promise.all([
    base(),
    mitSensor().or('power_peaks.is.null,hr_zone_minutes.is.null,aerobic_decoupling_pct.is.null'),
    mitSensor(),
    base().is('weather_temp_c', null),
    base().is('segments_synced_at', null),
    base()
      .gte('moving_time_s', 45 * 60)
      .or('device_watts.eq.true,average_watts.not.is.null')
      .not('power_peaks', 'is', null)
      .is('aerobic_decoupling_pct', null),
    base()
      .gte('moving_time_s', 45 * 60)
      .or('device_watts.eq.true,average_watts.not.is.null'),
  ])

  return baueBackfillStatus({
    activityCount: activityTotal ?? 0,
    streamsPending: streamsPending ?? 0,
    streamsTotal: streamsEligible ?? 0,
    weatherPending: weatherPending ?? 0,
    weatherTotal: activityTotal ?? 0,
    segmentsPending: segmentsPending ?? 0,
    segmentsTotal: activityTotal ?? 0,
    decouplingPending: decouplingPending ?? 0,
    decouplingTotal: decouplingEligible ?? 0,
  })
}

export async function ladeBackfillStatus(sb: SupabaseClient): Promise<BackfillStatus> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) {
    return baueBackfillStatus({
      activityCount: 0,
      streamsPending: 0,
      streamsTotal: 0,
      weatherPending: 0,
      weatherTotal: 0,
      segmentsPending: 0,
      segmentsTotal: 0,
      decouplingPending: 0,
      decouplingTotal: 0,
    })
  }
  return zaehleBackfillFuerOwner(sb, user.id)
}

export async function synchronisiereStravaBackfill(
  sb: SupabaseClient,
  opts: { maxRounds?: number } = {},
): Promise<{
  rounds: number
  streamsAnalysiert: number
  wetterAngereichert: number
  segmenteGeladen: number
  backfill: BackfillStatus
}> {
  const maxRounds = opts.maxRounds ?? 15
  let streamsAnalysiert = 0
  let wetterAngereichert = 0
  let segmenteGeladen = 0
  let rounds = 0

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')
  const token = await holeGueltigenAccessToken(sb)
  if (!token) throw new Error('Keine Strava-Verbindung.')

  for (let r = 0; r < maxRounds; r++) {
    rounds = r + 1
    const before = await zaehleBackfillFuerOwner(sb, user.id)
    if (before.allComplete) break

    const result = await synchronisiereStravaIntern(sb, user.id, token, { nurAnalyse: true, maxPages: 1 })
    streamsAnalysiert += result.streamsAnalysiert
    wetterAngereichert += result.wetterAngereichert
    segmenteGeladen += result.segmenteGeladen

    const after = await zaehleBackfillFuerOwner(sb, user.id)
    if (after.allComplete) break
    if (after.totalPending >= before.totalPending) break
  }

  const backfill = await zaehleBackfillFuerOwner(sb, user.id)
  return { rounds, streamsAnalysiert, wetterAngereichert, segmenteGeladen, backfill }
}

export async function stravaStatus(sb: SupabaseClient | null): Promise<{
  configured: boolean
  connected: boolean
  athlete?: StravaAthleteProfile | null
  activityCount?: number
}> {
  const configured = stravaApiKonfiguriert()
  if (!sb) return { configured, connected: false }

  const tokens = await leseStravaTokensDb(sb)
  const connected = Boolean(tokens)
  const athlete = connected ? await leseAthleteProfilDb(sb) : null
  let activityCount = 0
  if (connected) {
    const {
      data: { user },
    } = await sb.auth.getUser()
    if (user?.id) {
      const { count } = await sb
        .from('strava_activities')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
      activityCount = count ?? 0
    }
  }
  return { configured, connected, athlete, activityCount }
}

export async function stravaTrennen(sb: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await loescheStravaTokensDb(sb)
  await sb.from('strava_segment_efforts').delete().eq('owner_user_id', user.id)
  await sb.from('strava_activities').delete().eq('owner_user_id', user.id)
  await sb.from('strava_athlete_profile').delete().eq('owner_user_id', user.id)
}

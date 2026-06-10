/** Strava — Token, API & Sync (nur Server). */

import {
  berechnePowerPeaksAusStream,
  geschwindigkeitKmh,
  kilojoulesZuKcal,
  parsePowerPeaks,
} from '@/lib/strava/strava-power'
import {
  leseStravaTokensDb,
  loescheStravaTokensDb,
  speichereStravaTokensAdmin,
  speichereStravaTokensDb,
} from '@/lib/strava/strava-oauth-store'
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

export async function tauscheAuthCode(
  code: string,
  origin: string,
  ownerUserId: string,
): Promise<void> {
  const tokens = await tauscheCode(code, stravaRedirectUri(origin))
  await speichereStravaTokensAdmin(ownerUserId, tokens)
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
  return {
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
  }
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
): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
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
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (existing) {
    await sb.from('strava_athlete_profile').update(payload).eq('owner_user_id', user.id)
  } else {
    await sb.from('strava_athlete_profile').insert({ owner_user_id: user.id, ...payload })
  }
}

export async function leseAthleteProfilDb(sb: SupabaseClient): Promise<StravaAthleteProfile | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  const { data } = await sb
    .from('strava_athlete_profile')
    .select('omnia_weight_kg, weight_kg, ftp, max_hr, firstname, lastname')
    .eq('owner_user_id', user.id)
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
  }
}

export async function speichereOmniaGewicht(sb: SupabaseClient, kg: number | null): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')
  const weight = kg != null && kg > 0 && kg < 300 ? kg : null
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

type WattStreamBundle = {
  watts?: { data?: number[] }
  time?: { data?: number[] }
}

async function ladeWattStream(token: string, stravaId: number): Promise<WattStreamBundle | null> {
  try {
    return await stravaGet<WattStreamBundle>(token, `/activities/${stravaId}/streams`, {
      keys: 'watts,time',
      key_by_type: 'true',
    })
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function synchronisierePowerStreams(
  sb: SupabaseClient,
  token: string,
  ownerUserId: string,
): Promise<number> {
  const { data: kandidaten } = await sb
    .from('strava_activities')
    .select('strava_id')
    .eq('owner_user_id', ownerUserId)
    .is('power_peaks', null)
    .or('device_watts.eq.true,max_watts.gt.0,weighted_avg_watts.gt.0,average_watts.gt.0')
    .order('start_date', { ascending: false })
    .limit(MAX_STREAMS_PRO_SYNC)

  if (!kandidaten?.length) return 0

  let count = 0
  for (const row of kandidaten) {
    const stravaId = Number(row.strava_id)
    const stream = await ladeWattStream(token, stravaId)
    await sleep(STREAM_PAUSE_MS)

    const watts = stream?.watts?.data ?? []
    const time = stream?.time?.data ?? []
    let peaks = watts.length > 0 && time.length === watts.length ? berechnePowerPeaksAusStream(watts, time) : null

    if (!peaks || !Object.values(peaks).some((v) => v != null)) {
      await sb
        .from('strava_activities')
        .update({ power_peaks: {} })
        .eq('owner_user_id', ownerUserId)
        .eq('strava_id', stravaId)
      continue
    }

    const { error } = await sb
      .from('strava_activities')
      .update({ power_peaks: peaks })
      .eq('owner_user_id', ownerUserId)
      .eq('strava_id', stravaId)
    if (!error) count += 1
  }
  return count
}

async function neuestesAktivitaetsDatum(sb: SupabaseClient): Promise<number | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  const { data } = await sb
    .from('strava_activities')
    .select('start_date')
    .eq('owner_user_id', user.id)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.start_date) return null
  return Math.floor(Date.parse(String(data.start_date)) / 1000) - 86400 * 14
}

export async function synchronisiereStravaAktivitaeten(
  sb: SupabaseClient,
  token: string,
  maxPages = 60,
): Promise<{ imported: number; total: number; streamsAnalysiert: number }> {
  const meta = await ladeStravaAthleteMeta(token)
  await aktualisiereAthleteMetaVonStrava(sb, meta)

  const after = await neuestesAktivitaetsDatum(sb)
  const all: StravaActivityRow[] = []

  for (let page = 1; page <= maxPages; page++) {
    const params: Record<string, string> = {
      page: String(page),
      per_page: '200',
    }
    if (after != null) params.after = String(after)

    const batch = await stravaGet<StravaApiActivity[]>(token, '/athlete/activities', params)
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch.map(mapActivity))
    if (batch.length < 200) break
  }

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')

  if (all.length > 0) {
    const rows = all.map((a) => ({
      owner_user_id: user.id,
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
      synced_at: new Date().toISOString(),
    }))
    const { error } = await sb.from('strava_activities').upsert(rows, {
      onConflict: 'owner_user_id,strava_id',
    })
    if (error) throw new Error(`Strava-Aktivitäten speichern: ${error.message}`)
  }

  const streamsAnalysiert = await synchronisierePowerStreams(sb, token, user.id)

  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)

  return { imported: all.length, total: count ?? 0, streamsAnalysiert }
}

export async function ladeGespeicherteAktivitaeten(sb: SupabaseClient): Promise<StravaActivityRow[]> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return []
  const { data, error } = await sb
    .from('strava_activities')
    .select(
      'strava_id, name, sport_type, type, start_date, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_watts, weighted_avg_watts, max_watts, average_heartrate, max_heartrate, kilojoules, calories_kcal, average_speed_kmh, device_watts, power_peaks',
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
  }))
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
  await sb.from('strava_activities').delete().eq('owner_user_id', user.id)
  await sb.from('strava_athlete_profile').delete().eq('owner_user_id', user.id)
}

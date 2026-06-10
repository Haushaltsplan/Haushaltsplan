/** Strava — Token, API & Sync (nur Server). */

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
  return {
    strava_id: a.id,
    name: a.name?.trim() || 'Fahrt',
    sport_type: a.sport_type || a.type || 'Ride',
    type: a.type ?? null,
    start_date: a.start_date,
    distance_m: Number(a.distance) || 0,
    moving_time_s: Number(a.moving_time) || 0,
    elapsed_time_s: a.elapsed_time != null ? Number(a.elapsed_time) : null,
    elevation_gain_m: a.total_elevation_gain != null ? Number(a.total_elevation_gain) : null,
    average_watts: a.average_watts != null ? Number(a.average_watts) : null,
    weighted_avg_watts: a.weighted_average_watts != null ? Number(a.weighted_average_watts) : null,
    max_watts: a.max_watts != null ? Number(a.max_watts) : null,
    average_heartrate: a.average_heartrate != null ? Number(a.average_heartrate) : null,
    max_heartrate: a.max_heartrate != null ? Number(a.max_heartrate) : null,
    kilojoules: a.kilojoules != null ? Number(a.kilojoules) : null,
  }
}

export async function ladeStravaAthlete(token: string): Promise<StravaAthleteProfile & { athleteId?: number }> {
  const a = await stravaGet<StravaApiAthlete>(token, '/athlete')
  return {
    athleteId: a.id,
    weight_kg: a.weight != null && a.weight > 0 ? a.weight : null,
    ftp: a.ftp != null && a.ftp > 0 ? a.ftp : null,
    max_hr: a.max_heartrate != null && a.max_heartrate > 0 ? Math.round(a.max_heartrate) : null,
    firstname: a.firstname?.trim() || null,
    lastname: a.lastname?.trim() || null,
  }
}

async function speichereAthleteProfil(sb: SupabaseClient, profil: StravaAthleteProfile): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await sb.from('strava_athlete_profile').upsert({
    owner_user_id: user.id,
    weight_kg: profil.weight_kg,
    ftp: profil.ftp,
    max_hr: profil.max_hr,
    firstname: profil.firstname,
    lastname: profil.lastname,
    updated_at: new Date().toISOString(),
  })
}

export async function leseAthleteProfilDb(sb: SupabaseClient): Promise<StravaAthleteProfile | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  const { data } = await sb
    .from('strava_athlete_profile')
    .select('weight_kg, ftp, max_hr, firstname, lastname')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (!data) return null
  return {
    weight_kg: data.weight_kg != null ? Number(data.weight_kg) : null,
    ftp: data.ftp != null ? Number(data.ftp) : null,
    max_hr: data.max_hr != null ? Number(data.max_hr) : null,
    firstname: data.firstname,
    lastname: data.lastname,
  }
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
): Promise<{ imported: number; total: number }> {
  const athlete = await ladeStravaAthlete(token)
  await speichereAthleteProfil(sb, athlete)

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
      synced_at: new Date().toISOString(),
    }))
    const { error } = await sb.from('strava_activities').upsert(rows, {
      onConflict: 'owner_user_id,strava_id',
    })
    if (error) throw new Error(`Strava-Aktivitäten speichern: ${error.message}`)
  }

  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)

  return { imported: all.length, total: count ?? 0 }
}

export async function ladeGespeicherteAktivitaeten(sb: SupabaseClient): Promise<StravaActivityRow[]> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return []
  const { data, error } = await sb
    .from('strava_activities')
    .select(
      'strava_id, name, sport_type, type, start_date, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_watts, weighted_avg_watts, max_watts, average_heartrate, max_heartrate, kilojoules',
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

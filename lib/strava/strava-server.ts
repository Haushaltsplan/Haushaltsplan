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
import { geschaetztesTss } from '@/lib/strava/strava-training-load'
import {
  aktualisiereVerbindungTokens,
  ladeStravaVerbindung,
  listeStravaVerbindungen,
  loescheStravaVerbindung,
  primaereVerbindung,
  speichereVerbindungProfil,
  speichereVerbindungTokensAdmin,
  verbindungOeffentlich,
  type StravaConnectionRow,
  type StravaLinkMode,
} from '@/lib/strava/strava-connections'
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
/** Streams pro Verbindung und Sync (API-Schonung bei mehreren Athleten). */
const MAX_STREAMS_PRO_VERBINDUNG = 12

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
  pending: { ownerUserId: string; linkMode: StravaLinkMode; guestLabel: string | null },
): Promise<void> {
  const tokens = await tauscheCode(code, stravaRedirectUri(origin))
  const meta = await ladeStravaAthleteMeta(tokens.accessToken)

  await speichereVerbindungTokensAdmin(pending.ownerUserId, {
    linkMode: pending.linkMode,
    guestLabel: pending.guestLabel,
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAtMs: tokens.expiresAtMs,
      athleteId: tokens.athleteId ?? meta.athleteId ?? null,
    },
    meta: {
      firstname: meta.firstname,
      lastname: meta.lastname,
      ftp: meta.ftp,
      max_hr: meta.max_hr,
    },
  })

  if (pending.linkMode === 'primary') {
    await speichereStravaTokensAdmin(pending.ownerUserId, tokens)
    const sbAdmin = (await import('@/lib/supabase-admin')).createSupabaseAdmin()
    await aktualisiereAthleteMetaVonStrava(sbAdmin as unknown as SupabaseClient, meta)
  }
}

async function holeTokenFuerVerbindung(
  sb: SupabaseClient,
  connection: StravaConnectionRow,
): Promise<string | null> {
  if (connection.id === 'legacy-primary') {
    return holeGueltigenAccessTokenLegacy(sb)
  }
  if (!connection.accessToken || !connection.refreshToken) return null
  if (connection.expiresAtMs != null && connection.expiresAtMs > Date.now()) {
    return connection.accessToken
  }
  try {
    const fresh = await refreshTokens(connection.refreshToken)
    await aktualisiereVerbindungTokens(sb, connection.id, {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      expiresAtMs: fresh.expiresAtMs,
    })
    return fresh.accessToken
  } catch {
    return null
  }
}

export async function holeGueltigenAccessToken(
  sb: SupabaseClient | null,
  connectionId?: string | null,
): Promise<string | null> {
  if (!sb) return null
  if (connectionId && connectionId !== 'legacy-primary') {
    const conn = await ladeStravaVerbindung(sb, connectionId)
    if (conn) return holeTokenFuerVerbindung(sb, conn)
  }
  const primary = await primaereVerbindung(sb)
  if (primary) return holeTokenFuerVerbindung(sb, primary)
  return holeGueltigenAccessTokenLegacy(sb)
}

async function holeGueltigenAccessTokenLegacy(sb: SupabaseClient): Promise<string | null> {
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

export async function leseAthleteProfilDb(
  sb: SupabaseClient,
  connectionId?: string | null,
): Promise<StravaAthleteProfile | null> {
  const conn = connectionId
    ? await ladeStravaVerbindung(sb, connectionId)
    : await primaereVerbindung(sb)
  if (conn) return conn.profile

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  const { data } = await sb
    .from('strava_athlete_profile')
    .select(
      'omnia_weight_kg, weight_kg, ftp, max_hr, firstname, lastname, goal_km_year, goal_hm_year, goal_rides_per_week, goal_event_name, goal_event_date',
    )
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
    goal_km_year: data.goal_km_year != null ? Number(data.goal_km_year) : null,
    goal_hm_year: data.goal_hm_year != null ? Number(data.goal_hm_year) : null,
    goal_rides_per_week: data.goal_rides_per_week != null ? Number(data.goal_rides_per_week) : null,
    goal_event_name: data.goal_event_name,
    goal_event_date: data.goal_event_date,
  }
}

export async function speichereOmniaGewicht(
  sb: SupabaseClient,
  kg: number | null,
  connectionId?: string | null,
): Promise<void> {
  const weight = kg != null && kg > 0 && kg < 300 ? kg : null
  const conn = connectionId ? await ladeStravaVerbindung(sb, connectionId) : await primaereVerbindung(sb)
  if (conn && conn.id !== 'legacy-primary') {
    await speichereVerbindungProfil(sb, conn.id, { omnia_weight_kg: weight })
    return
  }

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
    goal_event_name?: string | null
    goal_event_date?: string | null
  },
  connectionId?: string | null,
): Promise<void> {
  const conn = connectionId ? await ladeStravaVerbindung(sb, connectionId) : await primaereVerbindung(sb)
  if (conn && conn.id !== 'legacy-primary') {
    await speichereVerbindungProfil(sb, conn.id, goals)
    return
  }

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')

  const payload = {
    goal_km_year: goals.goal_km_year ?? null,
    goal_hm_year: goals.goal_hm_year ?? null,
    goal_rides_per_week: goals.goal_rides_per_week ?? null,
    goal_event_name: goals.goal_event_name?.trim() || null,
    goal_event_date: goals.goal_event_date || null,
    updated_at: new Date().toISOString(),
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

async function synchronisiereActivityStreams(
  sb: SupabaseClient,
  token: string,
  connectionId: string,
  ownerUserId: string,
  maxHr: number | null,
): Promise<number> {
  let query = sb
    .from('strava_activities')
    .select('strava_id, average_heartrate, device_watts, average_watts, max_watts, weighted_avg_watts')
    .eq('owner_user_id', ownerUserId)
    .or('power_peaks.is.null,hr_zone_minutes.is.null')
    .order('start_date', { ascending: false })
    .limit(MAX_STREAMS_PRO_VERBINDUNG)

  if (connectionId !== 'legacy-primary') {
    query = query.eq('connection_id', connectionId)
  } else {
    query = query.is('connection_id', null)
  }

  const { data: kandidaten } = await query

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

    if (Object.keys(update).length === 0) continue

    let upd = sb.from('strava_activities').update(update).eq('owner_user_id', ownerUserId).eq('strava_id', stravaId)
    if (connectionId !== 'legacy-primary') {
      upd = upd.eq('connection_id', connectionId)
    }
    const { error } = await upd
    if (!error) count += 1
  }
  return count
}

async function neuestesAktivitaetsDatum(sb: SupabaseClient, connectionId: string): Promise<number | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null

  let query = sb
    .from('strava_activities')
    .select('start_date')
    .eq('owner_user_id', user.id)
    .order('start_date', { ascending: false })
    .limit(1)

  if (connectionId !== 'legacy-primary') {
    query = query.eq('connection_id', connectionId)
  } else {
    query = query.is('connection_id', null)
  }

  const { data } = await query.maybeSingle()
  if (!data?.start_date) return null
  return Math.floor(Date.parse(String(data.start_date)) / 1000) - 86400 * 14
}

async function synchronisiereEinVerbindung(
  sb: SupabaseClient,
  connection: StravaConnectionRow,
  opts: { maxPages?: number; fullImport?: boolean },
): Promise<{ imported: number; streamsAnalysiert: number }> {
  const maxPages = opts.maxPages ?? 60
  const token = await holeTokenFuerVerbindung(sb, connection)
  if (!token) throw new Error(`Strava-Token für „${connection.label}“ ungültig — bitte erneut verbinden.`)

  const meta = await ladeStravaAthleteMeta(token)
  if (connection.isPrimary) {
    await aktualisiereAthleteMetaVonStrava(sb, meta)
  }

  const after = opts.fullImport ? null : await neuestesAktivitaetsDatum(sb, connection.id)
  const all: StravaActivityRow[] = []

  for (let page = 1; page <= maxPages; page++) {
    const params: Record<string, string> = { page: String(page), per_page: '200' }
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

  const ftp = connection.profile.ftp ?? null
  const dbConnectionId = connection.id === 'legacy-primary' ? null : connection.id

  if (all.length > 0) {
    const rows = all.map((a) => ({
      owner_user_id: user.id,
      connection_id: dbConnectionId,
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
      synced_at: new Date().toISOString(),
    }))

    if (dbConnectionId) {
      const { error } = await sb.from('strava_activities').upsert(rows, {
        onConflict: 'connection_id,strava_id',
      })
      if (error) throw new Error(`Strava-Aktivitäten speichern: ${error.message}`)
    } else {
      const { error } = await sb.from('strava_activities').upsert(rows, {
        onConflict: 'owner_user_id,strava_id',
      })
      if (error) throw new Error(`Strava-Aktivitäten speichern: ${error.message}`)
    }
  }

  const maxHr = connection.profile.max_hr ?? meta.max_hr
  const streamsAnalysiert = await synchronisiereActivityStreams(
    sb,
    token,
    connection.id,
    user.id,
    maxHr,
  )

  return { imported: all.length, streamsAnalysiert }
}

export async function synchronisiereStravaAktivitaeten(
  sb: SupabaseClient,
  opts: {
    maxPages?: number
    fullImport?: boolean
    connectionId?: string | null
    syncAll?: boolean
  } = {},
): Promise<{ imported: number; total: number; streamsAnalysiert: number; connectionsSynced: number }> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')

  const connections = await listeStravaVerbindungen(sb)
  let targets = connections

  if (opts.connectionId) {
    targets = connections.filter((c) => c.id === opts.connectionId)
  } else if (!opts.syncAll) {
    targets = [connections.find((c) => c.isPrimary) ?? connections[0]].filter(Boolean) as StravaConnectionRow[]
  }

  if (targets.length === 0) {
    const token = await holeGueltigenAccessTokenLegacy(sb)
    if (!token) throw new Error('Keine Strava-Verbindung.')
    const legacy: StravaConnectionRow = {
      id: 'legacy-primary',
      label: 'Ich',
      isPrimary: true,
      stravaAthleteId: null,
      accessToken: token,
      refreshToken: null,
      expiresAtMs: null,
      profile: (await leseAthleteProfilDb(sb)) ?? {
        omnia_weight_kg: null,
        ftp: null,
        max_hr: null,
        firstname: null,
        lastname: null,
        goal_km_year: null,
        goal_hm_year: null,
        goal_rides_per_week: null,
        goal_event_name: null,
        goal_event_date: null,
      },
    }
    targets = [legacy]
  }

  let imported = 0
  let streamsAnalysiert = 0
  for (const conn of targets) {
    const r = await synchronisiereEinVerbindung(sb, conn, opts)
    imported += r.imported
    streamsAnalysiert += r.streamsAnalysiert
  }

  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)

  return {
    imported,
    total: count ?? 0,
    streamsAnalysiert,
    connectionsSynced: targets.length,
  }
}

export async function ladeGespeicherteAktivitaeten(
  sb: SupabaseClient,
  connectionId?: string | null,
): Promise<StravaActivityRow[]> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return []

  let query = sb
    .from('strava_activities')
    .select(
      'strava_id, name, sport_type, type, start_date, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_watts, weighted_avg_watts, max_watts, average_heartrate, max_heartrate, kilojoules, calories_kcal, average_speed_kmh, device_watts, power_peaks, summary_polyline, suffer_score, gear_id, workout_type, hr_zone_minutes, estimated_tss, connection_id',
    )
    .eq('owner_user_id', user.id)
    .order('start_date', { ascending: false })

  if (connectionId && connectionId !== 'legacy-primary') {
    query = query.eq('connection_id', connectionId)
  } else if (connectionId === 'legacy-primary') {
    query = query.is('connection_id', null)
  }

  const { data, error } = await query
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
  }))
}

export async function stravaStatus(sb: SupabaseClient | null): Promise<{
  configured: boolean
  connected: boolean
  athlete?: StravaAthleteProfile | null
  activityCount?: number
  connections?: import('@/lib/strava/strava-connections').StravaConnectionPublic[]
}> {
  const configured = stravaApiKonfiguriert()
  if (!sb) return { configured, connected: false }

  const raw = await listeStravaVerbindungen(sb)
  const connections = raw.map((c) => verbindungOeffentlich(c))
  const connected = connections.length > 0
  const primary = raw.find((c) => c.isPrimary) ?? raw[0]
  const athlete = primary?.profile ?? null
  const activityCount = connections.reduce((s, c) => s + (c.activityCount ?? 0), 0)

  return { configured, connected, athlete, activityCount, connections }
}

export async function stravaTrenneVerbindung(sb: SupabaseClient, connectionId: string): Promise<void> {
  await loescheStravaVerbindung(sb, connectionId)
}

export async function stravaTrennen(sb: SupabaseClient): Promise<void> {
  const connections = await listeStravaVerbindungen(sb)
  for (const c of connections) {
    if (c.id !== 'legacy-primary') {
      await loescheStravaVerbindung(sb, c.id)
    }
  }
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await loescheStravaTokensDb(sb)
  await sb.from('strava_activities').delete().eq('owner_user_id', user.id)
  await sb.from('strava_athlete_profile').delete().eq('owner_user_id', user.id)
}

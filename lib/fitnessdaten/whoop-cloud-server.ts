/** WHOOP Cloud — Token & API (nur Server). */

import {
  WHOOP_OAUTH_COOKIE,
  WHOOP_OAUTH_STATE_COOKIE,
  WHOOP_SCOPES,
  type WhoopCloudBodyMeasurements,
  type WhoopCloudCycleRow,
  type WhoopCloudRecoveryRow,
  type WhoopCloudSleepRow,
  type WhoopCloudSyncPayload,
  type WhoopCloudWorkoutRow,
  whoopApiKonfiguriert,
  whoopRedirectUri,
} from '@/lib/fitnessdaten/whoop-cloud-types'
import { ladeWhoopBffSync } from '@/lib/fitnessdaten/whoop-bff-server'
import {
  leseWhoopTokensDb,
  loescheWhoopTokensDb,
  speichereWhoopTokensAdmin,
  speichereWhoopTokensDb,
  type WhoopStoredTokens,
} from '@/lib/fitnessdaten/whoop-oauth-store'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
/** WHOOP Developer API — ohne /developer liefert die API 404 „default backend“. */
const API_BASE = 'https://api.prod.whoop.com/developer'

type StoredTokens = WhoopStoredTokens

type WhoopRecoveryScore = {
  recovery_score?: number
  resting_heart_rate?: number
  hrv_rmssd_milli?: number
  spo2_percentage?: number
  skin_temp_celsius?: number
}

type WhoopRecoveryRecord = {
  created_at?: string
  score_state?: string
  score?: WhoopRecoveryScore
}

type Paginated<T> = { records?: T[]; next_token?: string }

type SleepRec = {
  start?: string
  end?: string
  score_state?: string
  score?: {
    stage_summary?: {
      total_light_sleep_time_milli?: number
      total_slow_wave_sleep_time_milli?: number
      total_rem_sleep_time_milli?: number
      total_awake_time_milli?: number
      total_in_bed_time_milli?: number
    }
    sleep_needed?: {
      baseline_milli?: number
      need_from_sleep_debt_milli?: number
      need_from_recent_strain_milli?: number
      need_from_recent_nap_milli?: number
    }
    respiratory_rate?: number
    sleep_performance_percentage?: number
    sleep_efficiency_percentage?: number
    sleep_consistency_percentage?: number
  }
}

type CycleRec = {
  start?: string
  end?: string | null
  score_state?: string
  score?: {
    strain?: number
    kilojoule?: number
    average_heart_rate?: number
    max_heart_rate?: number
  }
}

type WorkoutRec = {
  id?: string | number
  start?: string
  end?: string
  sport_name?: string
  score_state?: string
  score?: {
    strain?: number
    average_heart_rate?: number
    max_heart_rate?: number
    kilojoule?: number
  }
}

function clientConfig() {
  const clientId = process.env.WHOOP_CLIENT_ID?.trim()
  const clientSecret = process.env.WHOOP_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('WHOOP_CLIENT_ID oder WHOOP_CLIENT_SECRET fehlt in .env.local')
  }
  return { clientId, clientSecret }
}

export function baueWhoopAuthUrl(origin: string, state: string): string {
  const { clientId } = clientConfig()
  const url = new URL(AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', whoopRedirectUri(origin))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', WHOOP_SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function setzeOAuthState(state: string): Promise<void> {
  const jar = await cookies()
  jar.set(WHOOP_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
}

export async function leseOAuthState(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(WHOOP_OAUTH_STATE_COOKIE)?.value ?? null
}

export async function loescheOAuthState(): Promise<void> {
  const jar = await cookies()
  jar.delete(WHOOP_OAUTH_STATE_COOKIE)
}

export async function speichereTokens(tokens: StoredTokens): Promise<void> {
  const jar = await cookies()
  jar.set(WHOOP_OAUTH_COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
  })
}

export async function loescheTokens(): Promise<void> {
  const jar = await cookies()
  jar.delete(WHOOP_OAUTH_COOKIE)
}

async function leseTokens(): Promise<StoredTokens | null> {
  const jar = await cookies()
  const raw = jar.get(WHOOP_OAUTH_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredTokens
    if (!parsed.accessToken || !parsed.refreshToken) return null
    return parsed
  } catch {
    return null
  }
}

async function tauscheCode(code: string, redirectUri: string): Promise<StoredTokens> {
  const { clientId, clientSecret } = clientConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  })
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WHOOP Token-Austausch fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: Date.now() + data.expires_in * 1000 - 60_000,
  }
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  const { clientId, clientSecret } = clientConfig()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'offline',
  })
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WHOOP Token-Refresh fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: Date.now() + data.expires_in * 1000 - 60_000,
  }
}

export async function tauscheAuthCode(
  code: string,
  origin: string,
  ownerUserId?: string | null,
): Promise<void> {
  const tokens = await tauscheCode(code, whoopRedirectUri(origin))
  if (ownerUserId) {
    await speichereWhoopTokensAdmin(ownerUserId, tokens)
  }
  await speichereTokens(tokens)
}

async function persistTokens(
  sb: SupabaseClient | null,
  tokens: StoredTokens,
): Promise<void> {
  if (sb) {
    try {
      await speichereWhoopTokensDb(sb, tokens)
      return
    } catch {
      /* Cookie-Fallback */
    }
  }
  await speichereTokens(tokens)
}

async function clearAllTokens(sb: SupabaseClient | null): Promise<void> {
  if (sb) await loescheWhoopTokensDb(sb)
  await loescheTokens()
}

export async function holeGueltigenAccessToken(sb: SupabaseClient | null = null): Promise<string | null> {
  let tokens = sb ? await leseWhoopTokensDb(sb) : null
  if (!tokens) tokens = await leseTokens()
  if (!tokens) return null
  if (Date.now() < tokens.expiresAtMs) return tokens.accessToken
  try {
    tokens = await refreshTokens(tokens.refreshToken)
    await persistTokens(sb, tokens)
    return tokens.accessToken
  } catch {
    await clearAllTokens(sb)
    return null
  }
}

function datumAusIso(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function msAusIso(iso: string | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function msToMin(ms: number | undefined | null): number | null {
  if (ms == null || ms <= 0) return null
  return Math.round(ms / 60_000)
}

async function fetchPaginated<T>(
  accessToken: string,
  path: string,
  startIso: string,
  maxPages = 8,
): Promise<T[]> {
  const out: T[] = []
  let next: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${API_BASE}${path}`)
    url.searchParams.set('limit', '25')
    url.searchParams.set('start', startIso)
    if (next) url.searchParams.set('nextToken', next)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.status === 401) throw new Error('WHOOP-Sitzung abgelaufen — bitte erneut verbinden.')
    if (!res.ok) throw new Error(`WHOOP ${path} (${res.status}): ${(await res.text()).slice(0, 160)}`)
    const data = (await res.json()) as Paginated<T>
    out.push(...(data.records ?? []))
    next = data.next_token
    if (!next) break
  }
  return out
}

function parseRecoveryRow(rec: WhoopRecoveryRecord): WhoopCloudRecoveryRow | null {
  if (rec.score_state !== 'SCORED' || !rec.score || !rec.created_at) return null
  const s = rec.score
  return {
    date: datumAusIso(rec.created_at),
    spo2Percent: s.spo2_percentage != null ? Math.round(s.spo2_percentage * 10) / 10 : null,
    skinTempC: s.skin_temp_celsius != null ? Math.round(s.skin_temp_celsius * 10) / 10 : null,
    recoveryPercent: s.recovery_score != null ? Math.round(s.recovery_score) : null,
    hrvRmssd: s.hrv_rmssd_milli != null ? Math.round(s.hrv_rmssd_milli * 10) / 10 : null,
    restingHr: s.resting_heart_rate != null ? Math.round(s.resting_heart_rate) : null,
  }
}

function parseSleepRow(rec: SleepRec): WhoopCloudSleepRow | null {
  if (rec.score_state !== 'SCORED' || !rec.score) return null
  const ref = rec.end ?? rec.start
  if (!ref) return null
  const st = rec.score.stage_summary
  const need = rec.score.sleep_needed
  const sleepMs =
    (st?.total_light_sleep_time_milli ?? 0) +
    (st?.total_slow_wave_sleep_time_milli ?? 0) +
    (st?.total_rem_sleep_time_milli ?? 0)
  const needMs =
    (need?.baseline_milli ?? 0) +
    (need?.need_from_sleep_debt_milli ?? 0) +
    (need?.need_from_recent_strain_milli ?? 0) -
    (need?.need_from_recent_nap_milli ?? 0)
  return {
    date: datumAusIso(ref),
    sleepScore:
      rec.score.sleep_performance_percentage != null
        ? Math.round(rec.score.sleep_performance_percentage)
        : null,
    sleepEfficiency:
      rec.score.sleep_efficiency_percentage != null
        ? Math.round(rec.score.sleep_efficiency_percentage)
        : null,
    sleepConsistency:
      rec.score.sleep_consistency_percentage != null
        ? Math.round(rec.score.sleep_consistency_percentage)
        : null,
    sleepMinutes: msToMin(sleepMs > 0 ? sleepMs : st?.total_in_bed_time_milli),
    sleepNeedMinutes: msToMin(needMs > 0 ? needMs : null),
    remMinutes: msToMin(st?.total_rem_sleep_time_milli),
    deepMinutes: msToMin(st?.total_slow_wave_sleep_time_milli),
    lightMinutes: msToMin(st?.total_light_sleep_time_milli),
    awakeMinutes: msToMin(st?.total_awake_time_milli),
    respiratoryRate:
      rec.score.respiratory_rate != null ? Math.round(rec.score.respiratory_rate * 10) / 10 : null,
    bedTimeMs: msAusIso(rec.start),
    wakeTimeMs: msAusIso(rec.end),
  }
}

function heuteIsoServer(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseCycleRow(rec: CycleRec): WhoopCloudCycleRow | null {
  if (!rec.score || !rec.start) return null
  if (rec.score_state === 'UNSCORABLE') return null
  const s = rec.score
  if (s.strain == null && s.kilojoule == null) return null
  // Laufender Zyklus (noch kein end) → Strain dem heutigen Tag zuordnen
  const date = rec.end ? datumAusIso(rec.start) : heuteIsoServer()
  return {
    date,
    strain: s.strain != null ? Math.round(s.strain * 10) / 10 : null,
    avgHr: s.average_heart_rate != null ? Math.round(s.average_heart_rate) : null,
    maxHr: s.max_heart_rate != null ? Math.round(s.max_heart_rate) : null,
    calories: s.kilojoule != null ? Math.round(s.kilojoule / 4.184) : null,
  }
}

function parseWorkoutRow(rec: WorkoutRec): WhoopCloudWorkoutRow | null {
  if (rec.score_state !== 'SCORED' || !rec.score || !rec.start) return null
  const startMs = msAusIso(rec.start)
  const endMs = msAusIso(rec.end) ?? startMs
  if (startMs == null) return null
  const s = rec.score
  const label = rec.sport_name?.trim() || 'Workout'
  return {
    id: String(rec.id ?? `${startMs}-${label}`),
    date: datumAusIso(rec.start),
    label,
    sport: rec.sport_name ?? null,
    strain: s.strain != null ? Math.round(s.strain * 10) / 10 : 0,
    startMs,
    endMs: endMs ?? startMs,
    avgHr: s.average_heart_rate != null ? Math.round(s.average_heart_rate) : null,
    maxHr: s.max_heart_rate != null ? Math.round(s.max_heart_rate) : null,
    calories: s.kilojoule != null ? Math.round(s.kilojoule / 4.184) : null,
  }
}

function dedupeByDate<T extends { date: string }>(rows: (T | null)[]): T[] {
  const m = new Map<string, T>()
  for (const r of rows) {
    if (r) m.set(r.date, r)
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function ladeBodyMeasurements(accessToken: string): Promise<WhoopCloudBodyMeasurements | null> {
  const res = await fetch(`${API_BASE}/v2/user/measurement/body`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const d = (await res.json()) as {
    height_meter?: number
    weight_kilogram?: number
    max_heart_rate?: number
  }
  return {
    heightCm: d.height_meter != null ? Math.round(d.height_meter * 1000) / 10 : null,
    weightKg: d.weight_kilogram != null ? Math.round(d.weight_kilogram * 10) / 10 : null,
    maxHr: d.max_heart_rate != null ? Math.round(d.max_heart_rate) : null,
  }
}

export async function ladeVollstaendigerCloudSync(accessToken: string, tage = 35): Promise<WhoopCloudSyncPayload> {
  const start = new Date()
  start.setDate(start.getDate() - tage)
  const startIso = start.toISOString()

  const [recoveryRaw, sleepRaw, cycleRaw, workoutRaw, body, bff] = await Promise.all([
    fetchPaginated<WhoopRecoveryRecord>(accessToken, '/v2/recovery', startIso),
    fetchPaginated<SleepRec>(accessToken, '/v2/activity/sleep', startIso),
    fetchPaginated<CycleRec>(accessToken, '/v2/cycle', startIso),
    fetchPaginated<WorkoutRec>(accessToken, '/v2/activity/workout', startIso),
    ladeBodyMeasurements(accessToken),
    ladeWhoopBffSync(accessToken),
  ])

  const workoutMap = new Map<string, WhoopCloudWorkoutRow>()
  for (const w of workoutRaw.map(parseWorkoutRow)) {
    if (w) workoutMap.set(w.id, w)
  }

  return {
    recoveries: dedupeByDate(recoveryRaw.map(parseRecoveryRow)),
    sleeps: dedupeByDate(sleepRaw.map(parseSleepRow)),
    cycles: dedupeByDate(cycleRaw.map(parseCycleRow)),
    workouts: [...workoutMap.values()].sort((a, b) => a.startMs - b.startMs),
    body,
    bff,
  }
}

export async function whoopCloudStatus(
  sb: SupabaseClient | null = null,
): Promise<{ configured: boolean; connected: boolean }> {
  const configured = whoopApiKonfiguriert()
  const token = configured ? await holeGueltigenAccessToken(sb) : null
  return { configured, connected: Boolean(token) }
}

export async function whoopCloudTrennen(sb: SupabaseClient | null = null): Promise<void> {
  await clearAllTokens(sb)
}

export { whoopApiKonfiguriert }

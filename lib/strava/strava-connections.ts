/** Strava — Multi-Athlet-Verbindungen (Manager + Gäste). */

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { StravaAthleteProfile, StravaSeasonGoals } from '@/lib/strava/strava-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_STRAVA_CONNECTIONS = 4
export const MAX_GUEST_CONNECTIONS = MAX_STRAVA_CONNECTIONS - 1

export type StravaLinkMode = 'primary' | 'guest'

export type StravaConnectionRow = {
  id: string
  label: string
  isPrimary: boolean
  stravaAthleteId: number | null
  accessToken: string | null
  refreshToken: string | null
  expiresAtMs: number | null
  profile: StravaAthleteProfile
  activityCount?: number
}

/** Für Client/API — ohne OAuth-Tokens. */
export type StravaConnectionPublic = Omit<
  StravaConnectionRow,
  'accessToken' | 'refreshToken' | 'expiresAtMs'
>

export function verbindungOeffentlich(c: StravaConnectionRow): StravaConnectionPublic {
  return {
    id: c.id,
    label: c.label,
    isPrimary: c.isPrimary,
    stravaAthleteId: c.stravaAthleteId,
    profile: c.profile,
    activityCount: c.activityCount,
  }
}

type DbConnection = {
  id: string
  label: string
  is_primary: boolean
  strava_athlete_id: number | null
  access_token: string | null
  refresh_token: string | null
  expires_at_ms: number | null
  firstname: string | null
  lastname: string | null
  ftp: number | null
  max_hr: number | null
  omnia_weight_kg: number | null
  goal_km_year: number | null
  goal_hm_year: number | null
  goal_rides_per_week: number | null
  goal_event_name: string | null
  goal_event_date: string | null
}

function mapProfil(row: DbConnection): StravaAthleteProfile {
  const kg = row.omnia_weight_kg != null ? Number(row.omnia_weight_kg) : null
  return {
    omnia_weight_kg: kg != null && kg > 0 ? kg : null,
    ftp: row.ftp != null ? Number(row.ftp) : null,
    max_hr: row.max_hr != null ? Number(row.max_hr) : null,
    firstname: row.firstname,
    lastname: row.lastname,
    goal_km_year: row.goal_km_year != null ? Number(row.goal_km_year) : null,
    goal_hm_year: row.goal_hm_year != null ? Number(row.goal_hm_year) : null,
    goal_rides_per_week: row.goal_rides_per_week != null ? Number(row.goal_rides_per_week) : null,
    goal_event_name: row.goal_event_name,
    goal_event_date: row.goal_event_date,
  }
}

function mapConnection(row: DbConnection, activityCount?: number): StravaConnectionRow {
  return {
    id: row.id,
    label: row.label,
    isPrimary: row.is_primary,
    stravaAthleteId: row.strava_athlete_id != null ? Number(row.strava_athlete_id) : null,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAtMs: row.expires_at_ms != null ? Number(row.expires_at_ms) : null,
    profile: mapProfil(row),
    activityCount,
  }
}

const CONNECTION_SELECT =
  'id, label, is_primary, strava_athlete_id, access_token, refresh_token, expires_at_ms, firstname, lastname, ftp, max_hr, omnia_weight_kg, goal_km_year, goal_hm_year, goal_rides_per_week, goal_event_name, goal_event_date'

export async function zaehleVerbindungen(sb: SupabaseClient, managerUserId: string): Promise<number> {
  const { count } = await sb
    .from('strava_connections')
    .select('*', { count: 'exact', head: true })
    .eq('manager_user_id', managerUserId)
  return count ?? 0
}

export async function listeStravaVerbindungen(sb: SupabaseClient): Promise<StravaConnectionRow[]> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return []

  const { data, error } = await sb
    .from('strava_connections')
    .select(CONNECTION_SELECT)
    .eq('manager_user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error || !data?.length) {
    return fallbackAusLegacyTokens(sb, user.id)
  }

  const counts = await Promise.all(
    data.map(async (row) => {
      const { count } = await sb
        .from('strava_activities')
        .select('*', { count: 'exact', head: true })
        .eq('connection_id', row.id)
      return count ?? 0
    }),
  )

  return data.map((row, i) => mapConnection(row as DbConnection, counts[i]))
}

/** Fallback wenn Migration noch nicht gelaufen — liest alte Token-Tabelle. */
async function fallbackAusLegacyTokens(sb: SupabaseClient, userId: string): Promise<StravaConnectionRow[]> {
  const { data: tok } = await sb
    .from('strava_oauth_tokens')
    .select('access_token, refresh_token, expires_at_ms, athlete_id')
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (!tok?.access_token) return []

  const { data: prof } = await sb
    .from('strava_athlete_profile')
    .select(
      'omnia_weight_kg, ftp, max_hr, firstname, lastname, goal_km_year, goal_hm_year, goal_rides_per_week, goal_event_name, goal_event_date',
    )
    .eq('owner_user_id', userId)
    .maybeSingle()

  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', userId)

  const label =
    prof?.firstname || prof?.lastname
      ? `${prof.firstname ?? ''} ${prof.lastname ?? ''}`.trim()
      : 'Ich'

  return [
    {
      id: 'legacy-primary',
      label,
      isPrimary: true,
      stravaAthleteId: tok.athlete_id != null ? Number(tok.athlete_id) : null,
      accessToken: String(tok.access_token),
      refreshToken: String(tok.refresh_token),
      expiresAtMs: Number(tok.expires_at_ms),
      profile: {
        omnia_weight_kg: prof?.omnia_weight_kg != null ? Number(prof.omnia_weight_kg) : null,
        ftp: prof?.ftp != null ? Number(prof.ftp) : null,
        max_hr: prof?.max_hr != null ? Number(prof.max_hr) : null,
        firstname: prof?.firstname ?? null,
        lastname: prof?.lastname ?? null,
        goal_km_year: prof?.goal_km_year != null ? Number(prof.goal_km_year) : null,
        goal_hm_year: prof?.goal_hm_year != null ? Number(prof.goal_hm_year) : null,
        goal_rides_per_week: prof?.goal_rides_per_week != null ? Number(prof.goal_rides_per_week) : null,
        goal_event_name: prof?.goal_event_name ?? null,
        goal_event_date: prof?.goal_event_date ?? null,
      },
      activityCount: count ?? 0,
    },
  ]
}

export async function ladeStravaVerbindung(
  sb: SupabaseClient,
  connectionId: string,
): Promise<StravaConnectionRow | null> {
  const list = await listeStravaVerbindungen(sb)
  if (connectionId === 'legacy-primary') return list.find((c) => c.isPrimary) ?? list[0] ?? null

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null

  const { data, error } = await sb
    .from('strava_connections')
    .select(CONNECTION_SELECT)
    .eq('manager_user_id', user.id)
    .eq('id', connectionId)
    .maybeSingle()

  if (error || !data) return list.find((c) => c.id === connectionId) ?? null

  const { count } = await sb
    .from('strava_activities')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connectionId)

  return mapConnection(data as DbConnection, count ?? 0)
}

export async function primaereVerbindung(sb: SupabaseClient): Promise<StravaConnectionRow | null> {
  const list = await listeStravaVerbindungen(sb)
  return list.find((c) => c.isPrimary) ?? list[0] ?? null
}

export async function speichereVerbindungTokensAdmin(
  managerUserId: string,
  opts: {
    linkMode: StravaLinkMode
    guestLabel?: string | null
    tokens: {
      accessToken: string
      refreshToken: string
      expiresAtMs: number
      athleteId: number | null
    }
    meta: {
      firstname: string | null
      lastname: string | null
      ftp: number | null
      max_hr: number | null
    }
  },
): Promise<string> {
  const admin = createSupabaseAdmin()
  const count = await zaehleVerbindungen(admin as unknown as SupabaseClient, managerUserId)

  if (opts.linkMode === 'guest' && count >= MAX_STRAVA_CONNECTIONS) {
    throw new Error(`Maximal ${MAX_STRAVA_CONNECTIONS} Strava-Profile (du + ${MAX_GUEST_CONNECTIONS} Freunde).`)
  }

  const label =
    opts.linkMode === 'guest'
      ? (opts.guestLabel?.trim() || opts.meta.firstname || 'Freund')
      : [opts.meta.firstname, opts.meta.lastname].filter(Boolean).join(' ') || 'Ich'

  if (opts.linkMode === 'primary') {
    const { data: existing } = await admin
      .from('strava_connections')
      .select('id')
      .eq('manager_user_id', managerUserId)
      .eq('is_primary', true)
      .maybeSingle()

    const payload = {
      manager_user_id: managerUserId,
      label,
      is_primary: true,
      strava_athlete_id: opts.tokens.athleteId,
      access_token: opts.tokens.accessToken,
      refresh_token: opts.tokens.refreshToken,
      expires_at_ms: opts.tokens.expiresAtMs,
      firstname: opts.meta.firstname,
      lastname: opts.meta.lastname,
      ftp: opts.meta.ftp,
      max_hr: opts.meta.max_hr,
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await admin.from('strava_connections').update(payload).eq('id', existing.id)
      if (error) throw new Error(error.message)
      await admin.from('strava_oauth_tokens').upsert({
        owner_user_id: managerUserId,
        access_token: opts.tokens.accessToken,
        refresh_token: opts.tokens.refreshToken,
        expires_at_ms: opts.tokens.expiresAtMs,
        athlete_id: opts.tokens.athleteId,
        updated_at: new Date().toISOString(),
      })
      return existing.id
    }

    const { data: inserted, error } = await admin
      .from('strava_connections')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    await admin.from('strava_oauth_tokens').upsert({
      owner_user_id: managerUserId,
      access_token: opts.tokens.accessToken,
      refresh_token: opts.tokens.refreshToken,
      expires_at_ms: opts.tokens.expiresAtMs,
      athlete_id: opts.tokens.athleteId,
      updated_at: new Date().toISOString(),
    })
    return String(inserted.id)
  }

  if (opts.tokens.athleteId != null) {
    const { data: dup } = await admin
      .from('strava_connections')
      .select('id')
      .eq('manager_user_id', managerUserId)
      .eq('strava_athlete_id', opts.tokens.athleteId)
      .maybeSingle()
    if (dup?.id) {
      const { error } = await admin
        .from('strava_connections')
        .update({
          access_token: opts.tokens.accessToken,
          refresh_token: opts.tokens.refreshToken,
          expires_at_ms: opts.tokens.expiresAtMs,
          firstname: opts.meta.firstname,
          lastname: opts.meta.lastname,
          ftp: opts.meta.ftp,
          max_hr: opts.meta.max_hr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dup.id)
      if (error) throw new Error(error.message)
      return String(dup.id)
    }
  }

  const { data: inserted, error } = await admin
    .from('strava_connections')
    .insert({
      manager_user_id: managerUserId,
      label,
      is_primary: false,
      strava_athlete_id: opts.tokens.athleteId,
      access_token: opts.tokens.accessToken,
      refresh_token: opts.tokens.refreshToken,
      expires_at_ms: opts.tokens.expiresAtMs,
      firstname: opts.meta.firstname,
      lastname: opts.meta.lastname,
      ftp: opts.meta.ftp,
      max_hr: opts.meta.max_hr,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return String(inserted.id)
}

export async function aktualisiereVerbindungTokens(
  sb: SupabaseClient,
  connectionId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAtMs: number },
): Promise<void> {
  const { error } = await sb
    .from('strava_connections')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at_ms: tokens.expiresAtMs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
  if (error) throw new Error(error.message)
}

export async function loescheStravaVerbindung(sb: SupabaseClient, connectionId: string): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return

  const conn = await ladeStravaVerbindung(sb, connectionId)
  if (!conn) return

  await sb.from('strava_activities').delete().eq('connection_id', connectionId)
  await sb.from('strava_connections').delete().eq('id', connectionId).eq('manager_user_id', user.id)

  if (conn.isPrimary) {
    await sb.from('strava_oauth_tokens').delete().eq('owner_user_id', user.id)
    await sb.from('strava_athlete_profile').delete().eq('owner_user_id', user.id)
  }
}

export async function speichereVerbindungProfil(
  sb: SupabaseClient,
  connectionId: string,
  patch: Partial<{ omnia_weight_kg: number | null } & StravaSeasonGoals>,
): Promise<void> {
  if (connectionId === 'legacy-primary') {
    return
  }
  const { error } = await sb
    .from('strava_connections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', connectionId)
  if (error) throw new Error(error.message)
}

export async function aktualisiereVerbindungLabel(
  sb: SupabaseClient,
  connectionId: string,
  label: string,
): Promise<void> {
  if (connectionId === 'legacy-primary') return
  const { error } = await sb
    .from('strava_connections')
    .update({ label: label.trim(), updated_at: new Date().toISOString() })
    .eq('id', connectionId)
  if (error) throw new Error(error.message)
}

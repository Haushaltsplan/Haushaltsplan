/** Strava OAuth — Tokens in Supabase. */

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { StravaStoredTokens } from '@/lib/strava/strava-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function speichereStravaPending(state: string, ownerUserId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { error } = await createSupabaseAdmin()
    .from('strava_oauth_pending')
    .insert({
      state,
      owner_user_id: ownerUserId,
      expires_at: expiresAt,
    })
  if (error) throw new Error(`Strava OAuth-Pending: ${error.message}`)
}

export async function loeseStravaPending(state: string): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('strava_oauth_pending')
    .select('owner_user_id, expires_at')
    .eq('state', state)
    .maybeSingle()
  if (error || !data) return null
  await admin.from('strava_oauth_pending').delete().eq('state', state)
  if (Date.parse(String(data.expires_at)) < Date.now()) return null
  return String(data.owner_user_id || '') || null
}

export async function speichereStravaTokensAdmin(
  ownerUserId: string,
  tokens: StravaStoredTokens,
): Promise<void> {
  const { error } = await createSupabaseAdmin().from('strava_oauth_tokens').upsert({
    owner_user_id: ownerUserId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at_ms: tokens.expiresAtMs,
    athlete_id: tokens.athleteId ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Strava-Token speichern: ${error.message}`)
}

export async function leseStravaTokensDb(sb: SupabaseClient): Promise<StravaStoredTokens | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  const { data, error } = await sb
    .from('strava_oauth_tokens')
    .select('access_token, refresh_token, expires_at_ms, athlete_id')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (error || !data) return null
  if (!data.access_token || !data.refresh_token) return null
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAtMs: Number(data.expires_at_ms),
    athleteId: data.athlete_id != null ? Number(data.athlete_id) : null,
  }
}

export async function speichereStravaTokensDb(
  sb: SupabaseClient,
  tokens: StravaStoredTokens,
): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')
  const { error } = await sb.from('strava_oauth_tokens').upsert({
    owner_user_id: user.id,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at_ms: tokens.expiresAtMs,
    athlete_id: tokens.athleteId ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Strava-Token speichern: ${error.message}`)
}

export async function loescheStravaTokensDb(sb: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await sb.from('strava_oauth_tokens').delete().eq('owner_user_id', user.id)
}

/** WHOOP OAuth — Tokens in Supabase (geräteübergreifend, nicht Browser-Cookie). */

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type WhoopStoredTokens = {
  accessToken: string
  refreshToken: string
  expiresAtMs: number
}

export async function speichereWhoopPending(state: string, ownerUserId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { error } = await createSupabaseAdmin()
    .from('whoop_oauth_pending')
    .insert({ state, owner_user_id: ownerUserId, expires_at: expiresAt })
  if (error) throw new Error(`WHOOP OAuth-Pending: ${error.message}`)
}

export async function loeseWhoopPending(state: string): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('whoop_oauth_pending')
    .select('owner_user_id, expires_at')
    .eq('state', state)
    .maybeSingle()
  if (error || !data) return null
  await admin.from('whoop_oauth_pending').delete().eq('state', state)
  if (Date.parse(String(data.expires_at)) < Date.now()) return null
  return String(data.owner_user_id || '') || null
}

export async function speichereWhoopTokensDb(
  sb: SupabaseClient,
  tokens: WhoopStoredTokens,
): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) throw new Error('Nicht angemeldet.')
  const { error } = await sb.from('whoop_oauth_tokens').upsert({
    owner_user_id: user.id,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at_ms: tokens.expiresAtMs,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`WHOOP-Token speichern: ${error.message}`)
}

export async function speichereWhoopTokensAdmin(
  ownerUserId: string,
  tokens: WhoopStoredTokens,
): Promise<void> {
  const { error } = await createSupabaseAdmin().from('whoop_oauth_tokens').upsert({
    owner_user_id: ownerUserId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at_ms: tokens.expiresAtMs,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`WHOOP-Token speichern: ${error.message}`)
}

export async function leseWhoopTokensDb(sb: SupabaseClient): Promise<WhoopStoredTokens | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  const { data, error } = await sb
    .from('whoop_oauth_tokens')
    .select('access_token, refresh_token, expires_at_ms')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (error || !data) return null
  if (!data.access_token || !data.refresh_token) return null
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAtMs: Number(data.expires_at_ms),
  }
}

export async function loescheWhoopTokensDb(sb: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await sb.from('whoop_oauth_tokens').delete().eq('owner_user_id', user.id)
}

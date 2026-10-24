/** YouTube OAuth — Tokens in Supabase (inkl. PKCE code_verifier im Pending). */

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type YoutubeStoredTokens = {
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  channelId: string | null
  channelTitle: string | null
}

export async function speichereYoutubePending(state: string, ownerUserId: string, codeVerifier: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { error } = await createSupabaseAdmin().from('youtube_oauth_pending').insert({
    state,
    owner_user_id: ownerUserId,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`YouTube OAuth-Pending: ${error.message}`)
}

export async function loeseYoutubePending(state: string): Promise<{ ownerUserId: string; codeVerifier: string } | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('youtube_oauth_pending')
    .select('owner_user_id, code_verifier, expires_at')
    .eq('state', state)
    .maybeSingle()
  if (error || !data) return null
  await admin.from('youtube_oauth_pending').delete().eq('state', state)
  if (Date.parse(String(data.expires_at)) < Date.now()) return null
  const ownerUserId = String(data.owner_user_id || '')
  const codeVerifier = String(data.code_verifier || '')
  if (!ownerUserId || !codeVerifier) return null
  return { ownerUserId, codeVerifier }
}

export async function speichereYoutubeTokensAdmin(ownerUserId: string, tokens: YoutubeStoredTokens): Promise<void> {
  const { error } = await createSupabaseAdmin().from('youtube_oauth_tokens').upsert({
    owner_user_id: ownerUserId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at_ms: tokens.expiresAtMs,
    channel_id: tokens.channelId,
    channel_title: tokens.channelTitle,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`YouTube-Token speichern: ${error.message}`)
}

export async function leseYoutubeTokensAdmin(ownerUserId: string): Promise<YoutubeStoredTokens | null> {
  const { data, error } = await createSupabaseAdmin()
    .from('youtube_oauth_tokens')
    .select('access_token, refresh_token, expires_at_ms, channel_id, channel_title')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle()
  if (error || !data || !data.access_token || !data.refresh_token) return null
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAtMs: Number(data.expires_at_ms),
    channelId: data.channel_id ? String(data.channel_id) : null,
    channelTitle: data.channel_title ? String(data.channel_title) : null,
  }
}

export async function loescheYoutubeTokensDb(sb: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await sb.from('youtube_oauth_tokens').delete().eq('owner_user_id', user.id)
}

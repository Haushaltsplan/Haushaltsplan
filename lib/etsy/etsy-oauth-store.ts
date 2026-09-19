/** Etsy OAuth — Tokens in Supabase (inkl. PKCE code_verifier im Pending). */

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { EtsyPendingRow, EtsyStoredTokens } from '@/lib/etsy/etsy-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function speichereEtsyPending(
  state: string,
  ownerUserId: string,
  codeVerifier: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { error } = await createSupabaseAdmin().from('etsy_oauth_pending').insert({
    state,
    owner_user_id: ownerUserId,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Etsy OAuth-Pending: ${error.message}`)
}

export async function loeseEtsyPending(state: string): Promise<EtsyPendingRow | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('etsy_oauth_pending')
    .select('owner_user_id, code_verifier, expires_at')
    .eq('state', state)
    .maybeSingle()
  if (error || !data) return null
  await admin.from('etsy_oauth_pending').delete().eq('state', state)
  if (Date.parse(String(data.expires_at)) < Date.now()) return null
  const ownerUserId = String(data.owner_user_id || '')
  const codeVerifier = String(data.code_verifier || '')
  if (!ownerUserId || !codeVerifier) return null
  return { ownerUserId, codeVerifier }
}

export async function speichereEtsyTokensAdmin(
  ownerUserId: string,
  tokens: EtsyStoredTokens,
): Promise<void> {
  const { error } = await createSupabaseAdmin().from('etsy_oauth_tokens').upsert({
    owner_user_id: ownerUserId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at_ms: tokens.expiresAtMs,
    etsy_user_id: tokens.etsyUserId ?? null,
    shop_id: tokens.shopId ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Etsy-Token speichern: ${error.message}`)
}

export async function leseEtsyTokensAdmin(ownerUserId: string): Promise<EtsyStoredTokens | null> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_oauth_tokens')
    .select('access_token, refresh_token, expires_at_ms, etsy_user_id, shop_id')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle()
  if (error || !data) return null
  if (!data.access_token || !data.refresh_token) return null
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAtMs: Number(data.expires_at_ms),
    etsyUserId: data.etsy_user_id != null ? Number(data.etsy_user_id) : null,
    shopId: data.shop_id != null ? Number(data.shop_id) : null,
  }
}

export async function leseEtsyTokensDb(sb: SupabaseClient): Promise<EtsyStoredTokens | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return null
  return leseEtsyTokensAdmin(user.id)
}

export async function loescheEtsyTokensDb(sb: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return
  await sb.from('etsy_oauth_tokens').delete().eq('owner_user_id', user.id)
}

export async function aktualisiereEtsyShopIdAdmin(ownerUserId: string, shopId: number): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from('etsy_oauth_tokens')
    .update({ shop_id: shopId, updated_at: new Date().toISOString() })
    .eq('owner_user_id', ownerUserId)
  if (error) throw new Error(`Etsy shop_id speichern: ${error.message}`)
}

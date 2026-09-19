/** Etsy — OAuth (PKCE), Token-Refresh & HTTP-Hilfen (nur Server). */

import 'server-only'

import {
  aktualisiereEtsyShopIdAdmin,
  leseEtsyTokensAdmin,
  leseEtsyTokensDb,
  loescheEtsyTokensDb,
  speichereEtsyTokensAdmin,
} from '@/lib/etsy/etsy-oauth-store'
import {
  ETSY_API_BASE,
  ETSY_SCOPES,
  etsyApiKeyHeader,
  etsyApiKonfiguriert,
  etsyClientId,
  etsyRedirectUri,
  type EtsyStoredTokens,
} from '@/lib/etsy/etsy-types'
import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const AUTH_URL = 'https://www.etsy.com/oauth/connect'
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token'

export { etsyApiKonfiguriert, etsyRedirectUri }

/** PKCE: 43–128 Zeichen aus [A-Za-z0-9._~-] */
export function erzeugePkcePaar(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function baueEtsyAuthUrl(
  origin: string,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', etsyClientId())
  url.searchParams.set('redirect_uri', etsyRedirectUri(origin))
  url.searchParams.set('scope', ETSY_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

function parseUserIdFromToken(accessToken: string): number | null {
  const prefix = accessToken.split('.')[0]
  const n = Number(prefix)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function tokenRequest(body: URLSearchParams): Promise<EtsyStoredTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Etsy Token-Request fehlgeschlagen (${res.status}): ${text.slice(0, 240)}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: Date.now() + Number(data.expires_in || 3600) * 1000 - 60_000,
    etsyUserId: parseUserIdFromToken(data.access_token),
  }
}

export async function tauscheEtsyAuthCode(opts: {
  code: string
  origin: string
  ownerUserId: string
  codeVerifier: string
}): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: etsyClientId(),
    redirect_uri: etsyRedirectUri(opts.origin),
    code: opts.code,
    code_verifier: opts.codeVerifier,
  })
  let tokens = await tokenRequest(body)
  try {
    const shopId = await holeShopIdFuerUser(tokens.accessToken, tokens.etsyUserId)
    if (shopId) tokens = { ...tokens, shopId }
  } catch (e) {
    console.warn('[etsy] shop_id nach Connect:', e instanceof Error ? e.message : e)
  }
  await speichereEtsyTokensAdmin(opts.ownerUserId, tokens)
}

async function refreshEtsyTokens(refreshToken: string): Promise<EtsyStoredTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: etsyClientId(),
    refresh_token: refreshToken,
  })
  return tokenRequest(body)
}

export async function holeGueltigenEtsyAccessToken(ownerUserId: string): Promise<EtsyStoredTokens> {
  const gespeichert = await leseEtsyTokensAdmin(ownerUserId)
  if (!gespeichert) throw new Error('Etsy ist nicht verbunden.')

  if (gespeichert.expiresAtMs > Date.now() + 30_000) {
    return gespeichert
  }

  try {
    const refreshed = await refreshEtsyTokens(gespeichert.refreshToken)
    const merged: EtsyStoredTokens = {
      ...refreshed,
      etsyUserId: refreshed.etsyUserId ?? gespeichert.etsyUserId,
      shopId: gespeichert.shopId,
    }
    await speichereEtsyTokensAdmin(ownerUserId, merged)
    return merged
  } catch (e) {
    await createSupabaseAdminDelete(ownerUserId)
    throw e instanceof Error ? e : new Error('Etsy Token-Refresh fehlgeschlagen.')
  }
}

async function createSupabaseAdminDelete(ownerUserId: string): Promise<void> {
  const { createSupabaseAdmin } = await import('@/lib/supabase-admin')
  await createSupabaseAdmin().from('etsy_oauth_tokens').delete().eq('owner_user_id', ownerUserId)
}

export async function etsyFetchJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${ETSY_API_BASE}${path}`
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('x-api-key', etsyApiKeyHeader())
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Etsy API ${res.status}: ${text.slice(0, 400)}`)
  }
  if (!text) return {} as T
  return JSON.parse(text) as T
}

async function holeShopIdFuerUser(accessToken: string, etsyUserId: number | null | undefined): Promise<number | null> {
  if (etsyUserId) {
    const data = await etsyFetchJson<{ shop_id?: number; results?: Array<{ shop_id?: number }> }>(
      accessToken,
      `/application/users/${etsyUserId}/shops`,
    )
    if (typeof data.shop_id === 'number') return data.shop_id
    const first = data.results?.[0]?.shop_id
    if (typeof first === 'number') return first
  }
  return null
}

export async function stelleShopIdSicher(ownerUserId: string, tokens: EtsyStoredTokens): Promise<number> {
  if (tokens.shopId && tokens.shopId > 0) return tokens.shopId
  const shopId = await holeShopIdFuerUser(tokens.accessToken, tokens.etsyUserId)
  if (!shopId) throw new Error('Keine Etsy-Shop-ID gefunden. Shop im Etsy-Konto anlegen und erneut verbinden.')
  await aktualisiereEtsyShopIdAdmin(ownerUserId, shopId)
  return shopId
}

export type EtsyShippingProfileKurz = {
  shippingProfileId: number
  title: string
}

export type EtsyReadinessStateKurz = {
  readinessStateId: number
  readinessState: string
}

export async function ladeEtsyShopKontext(ownerUserId: string): Promise<{
  shopId: number
  shopName: string | null
  shippingProfiles: EtsyShippingProfileKurz[]
  readinessStates: EtsyReadinessStateKurz[]
}> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)

  const shop = await etsyFetchJson<{ shop_name?: string; shop_id?: number }>(
    tokens.accessToken,
    `/application/shops/${shopId}`,
  ).catch(() => ({ shop_name: null as string | null }))

  let shippingProfiles: EtsyShippingProfileKurz[] = []
  try {
    const sp = await etsyFetchJson<{
      results?: Array<{ shipping_profile_id?: number; title?: string }>
      count?: number
    }>(tokens.accessToken, `/application/shops/${shopId}/shipping-profiles`)
    shippingProfiles = (sp.results ?? [])
      .filter((r) => typeof r.shipping_profile_id === 'number')
      .map((r) => ({
        shippingProfileId: Number(r.shipping_profile_id),
        title: String(r.title || `Profil ${r.shipping_profile_id}`),
      }))
  } catch (e) {
    console.warn('[etsy] shipping-profiles:', e instanceof Error ? e.message : e)
  }

  let readinessStates: EtsyReadinessStateKurz[] = []
  try {
    const rs = await etsyFetchJson<{
      results?: Array<{ readiness_state_id?: number; readiness_state?: string }>
    }>(tokens.accessToken, `/application/shops/${shopId}/readiness-state-definitions`)
    readinessStates = (rs.results ?? [])
      .filter((r) => typeof r.readiness_state_id === 'number')
      .map((r) => ({
        readinessStateId: Number(r.readiness_state_id),
        readinessState: String(r.readiness_state || ''),
      }))
  } catch (e) {
    console.warn('[etsy] readiness-states:', e instanceof Error ? e.message : e)
  }

  return {
    shopId,
    shopName: shop.shop_name ?? null,
    shippingProfiles,
    readinessStates,
  }
}

export async function etsyStatus(sb: SupabaseClient | null): Promise<{
  configured: boolean
  connected: boolean
  shopId: number | null
  shopName: string | null
}> {
  const configured = etsyApiKonfiguriert()
  if (!sb) return { configured, connected: false, shopId: null, shopName: null }

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return { configured, connected: false, shopId: null, shopName: null }

  const tokens = await leseEtsyTokensDb(sb)
  if (!tokens) return { configured, connected: false, shopId: null, shopName: null }

  let shopName: string | null = null
  let shopId = tokens.shopId ?? null
  try {
    const ctx = await ladeEtsyShopKontext(user.id)
    shopId = ctx.shopId
    shopName = ctx.shopName
  } catch {
    /* Shop ggf. noch unvollständig — Connect zählt trotzdem */
  }

  return { configured, connected: true, shopId, shopName }
}

export async function etsyTrennen(sb: SupabaseClient): Promise<void> {
  await loescheEtsyTokensDb(sb)
}

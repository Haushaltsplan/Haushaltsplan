/** Etsy — Typen & Hilfskonstanten. */

export const ETSY_SCOPES = ['listings_r', 'listings_w', 'shops_r'].join(' ')

export const ETSY_API_BASE = 'https://openapi.etsy.com/v3'

/** Häufige Kategorie: Home & Living › Kitchen › Serveware › Bowls (ggf. überschreiben). */
export const ETSY_DEFAULT_TAXONOMY_ID = 2078

export type EtsyStoredTokens = {
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  etsyUserId?: number | null
  shopId?: number | null
}

export type EtsyPendingRow = {
  ownerUserId: string
  codeVerifier: string
}

export type EtsyWhoMade = 'i_did' | 'collective' | 'someone_else'
export type EtsyWhenMade =
  | 'made_to_order'
  | '2020_2025'
  | '2010_2019'
  | '2000_2009'
  | 'before_2000'
  | '1990s'
  | '1980s'

export type EtsyListingBasis = {
  holzart?: string
  masse?: string
  preisEur: number
  quantity?: number
  shippingProfileId: number
  taxonomyId?: number
  readinessStateId?: number
  whoMade?: EtsyWhoMade
  whenMade?: EtsyWhenMade
  materials?: string[]
}

export type EtsyGeneratedListing = {
  title: string
  description: string
  tags: string[]
  warenkorbZusammenfassung: string
}

function oauthBasisUrl(requestOrigin?: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.OMNIA_CAPACITOR_SERVER_URL?.trim() ||
    requestOrigin?.trim() ||
    ''
  ).replace(/\/+$/, '')
}

export function etsyRedirectUri(requestOrigin?: string): string {
  const explicit = process.env.ETSY_REDIRECT_URI?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const basis = oauthBasisUrl(requestOrigin)
  if (!basis) {
    throw new Error('Etsy Redirect-URI: keine Basis-URL (NEXT_PUBLIC_APP_URL oder Request-Origin).')
  }
  return `${basis}/api/etsy/callback`
}

export function etsyApiKonfiguriert(): boolean {
  return Boolean(process.env.ETSY_CLIENT_ID?.trim() && process.env.ETSY_CLIENT_SECRET?.trim())
}

export function etsyClientId(): string {
  const id = process.env.ETSY_CLIENT_ID?.trim()
  if (!id) throw new Error('ETSY_CLIENT_ID fehlt in .env.local')
  return id
}

export function etsyClientSecret(): string {
  const s = process.env.ETSY_CLIENT_SECRET?.trim()
  if (!s) throw new Error('ETSY_CLIENT_SECRET fehlt in .env.local')
  return s
}

/** Header `x-api-key: keystring:shared_secret` */
export function etsyApiKeyHeader(): string {
  return `${etsyClientId()}:${etsyClientSecret()}`
}

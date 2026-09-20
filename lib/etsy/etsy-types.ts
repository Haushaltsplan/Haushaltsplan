/** Etsy — Typen & Hilfskonstanten. */

export const ETSY_SCOPES = ['listings_r', 'listings_w', 'shops_r'].join(' ')

export const ETSY_API_BASE = 'https://openapi.etsy.com/v3'

/** Fallback: Home & Living › Kitchen › Serveware › Bowls */
export const ETSY_DEFAULT_TAXONOMY_ID = 2078

export const ETSY_DEFAULT_STANDORT = 'Niederbayern'

export const ETSY_DEFAULT_FINISH =
  '2x lebensmittelechtes Walnussöl (natürlicher Schutz, mattglänzend)'

/** Bekannte Formen → Taxonomy-Fallback, falls die KI keine ID liefert. */
export const ETSY_FORM_TAXONOMY: Record<string, { id: number; label: string }> = {
  schale: { id: 2078, label: 'Schalen' },
  schuessel: { id: 2078, label: 'Schalen' },
  teller: { id: 2078, label: 'Teller / flache Gefäße' },
}

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
  /** Optionaler Wunschpreis — KI schlägt Spanne vor. */
  preisEur?: number
  quantity?: number
  shippingProfileId?: number
  taxonomyId?: number
  readinessStateId?: number
  whoMade?: EtsyWhoMade
  whenMade?: EtsyWhenMade
  materials?: string[]
  standortText?: string
  finishText?: string
}

export type EtsyFotoCheck = {
  hatHauptbild: boolean
  hatDetailMaserung: boolean
  hatMassstab: boolean
  warnungen: string[]
}

/** Maßstab-Hinweise filtern (optional — oft unschön auf Unikat-Fotos). */
export function istMassstabHinweis(text: string): boolean {
  return /maßstab|massstab|lineal|\bmünze\b|\bmuenze\b|apfel in der|größe von \d|groesse von \d|visuell.*(?:größe|groesse|erfassbar)|hand, münze|hand, muenze/i.test(
    text,
  )
}

export function filterFotoWarnungen(warnungen: string[]): string[] {
  return warnungen.filter((w) => w.trim() && !istMassstabHinweis(w))
}

export type EtsyGeneratedListing = {
  title: string
  description: string
  tags: string[]
  warenkorbZusammenfassung: string
  preisMinEur: number
  preisEmpfohlenEur: number
  preisMaxEur: number
  preisBegruendung: string
  produktForm: string
  taxonomyId: number
  taxonomyLabel: string
  fotoCheck: EtsyFotoCheck
}

export type EtsyListingVorlage = {
  shippingProfileId: number | null
  readinessStateId: number | null
  taxonomyId: number | null
  standortText: string
  finishText: string
  whoMade: EtsyWhoMade
  whenMade: EtsyWhenMade
}

export type EtsyDraftHistorieEintrag = {
  id: string
  listingId: number
  shopId: number
  title: string
  tags: string[]
  preisMinEur: number | null
  preisEmpfohlenEur: number | null
  preisMaxEur: number | null
  preisVerwendetEur: number
  taxonomyId: number | null
  holzart: string | null
  listingUrl: string | null
  createdAt: string
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

export function defaultEtsyVorlage(): EtsyListingVorlage {
  return {
    shippingProfileId: null,
    readinessStateId: null,
    taxonomyId: ETSY_DEFAULT_TAXONOMY_ID,
    standortText: ETSY_DEFAULT_STANDORT,
    finishText: ETSY_DEFAULT_FINISH,
    whoMade: 'i_did',
    whenMade: 'made_to_order',
  }
}

/** Etsy — Typen & Hilfskonstanten. */

export const ETSY_SCOPES = ['listings_r', 'listings_w', 'shops_r'].join(' ')

export const ETSY_API_BASE = 'https://openapi.etsy.com/v3'

/** Fallback: Home & Living › Home Decor › Decorative Bowls */
export const ETSY_DEFAULT_TAXONOMY_ID = 1003

export const ETSY_DEFAULT_STANDORT = 'Niederbayern'

export const ETSY_DEFAULT_FINISH =
  '2x lebensmittelechtes Walnussöl (natürlicher Schutz, mattglänzend)'

/** Bekannte Formen → Taxonomy-Fallback, falls die KI keine ID liefert. */
export const ETSY_FORM_TAXONOMY: Record<string, { id: number; label: string }> = {
  schale: { id: 1003, label: 'Dekorative Schalen' },
  schuessel: { id: 1003, label: 'Dekorative Schalen' },
  teller: { id: 1003, label: 'Dekorative Schalen' },
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
/** Aktuelle Etsy-API-Enums (jährlich aktualisiert — 2026: 2020_2026). */
export type EtsyWhenMade =
  | 'made_to_order'
  | '2020_2026'
  | '2010_2019'
  | '2007_2009'
  | 'before_2007'
  | '2000_2006'
  | '1990s'
  | '1980s'
  | '1970s'
  | '1960s'
  | '1950s'
  | '1940s'
  | '1930s'
  | '1920s'
  | '1910s'
  | '1900s'
  | '1800s'
  | '1700s'
  | 'before_1700'

export type EtsyListingBasis = {
  holzart?: string
  masse?: string
  /** Optionaler Wunschpreis — KI schlägt Spanne vor. */
  preisEur?: number
  quantity?: number
  shippingProfileId?: number
  taxonomyId?: number
  readinessStateId?: number
  shopSectionId?: number
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
  geoInsights?: EtsyListingGeoInsights
}

export type EtsyListingGeoInsights = {
  zielgruppe: string
  anlaesse: string[]
  /** Sprach-/Intent-Anfragen, für die das Listing zitierfähig sein soll */
  intentQueries: string[]
  /** Genutzte reale Markt-Phrasen (Autosuggest/Konkurrenz) */
  marktKeywords: string[]
}

export type EtsyListingVorlage = {
  shippingProfileId: number | null
  readinessStateId: number | null
  taxonomyId: number | null
  shopSectionId: number | null
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
    shopSectionId: null,
    standortText: ETSY_DEFAULT_STANDORT,
    finishText: ETSY_DEFAULT_FINISH,
    whoMade: 'i_did',
    /** Fertige Unikate (handgedreht) — nicht Auftragfertigung. */
    whenMade: '2020_2026',
  }
}

/** Legacy-Enums (z. B. 2020_2025) → aktuelle Etsy-API-Werte. */
export function normalisiereEtsyWhenMade(raw: string | null | undefined): EtsyWhenMade {
  const s = String(raw || '').trim()
  if (!s || s === '2020_2025') return '2020_2026'
  if (s === '2000_2009' || s === '2000_2005') return '2000_2006'
  if (s === 'before_2000' || s === 'before_2006') return 'before_2007'
  return s as EtsyWhenMade
}

/** Typen für Etsy SEO & GEO Audit / Überwachung. */

export type EtsySeoIssueSeverity = 'error' | 'warning' | 'info'

export type EtsySeoIssueField =
  | 'title'
  | 'tags'
  | 'description'
  | 'price'
  | 'attributes'
  | 'general'

export type EtsySeoIssue = {
  severity: EtsySeoIssueSeverity
  field: EtsySeoIssueField
  message: string
}

export type EtsyGeoInsights = {
  target_audience_clarity: 'Hoch' | 'Mittel' | 'Niedrig'
  missing_contexts: string[]
  what_clarity?: 'Hoch' | 'Mittel' | 'Niedrig'
  occasion_clarity?: 'Hoch' | 'Mittel' | 'Niedrig'
}

export type EtsySeoSuggestions = {
  optimized_title: string
  optimized_tags: string[]
  optimized_description_intro: string
  /** Optional: vollständige optimierte Beschreibung (nur wenn sinnvoll geändert). */
  optimized_description?: string | null
}

export type EtsySeoAuditResult = {
  overall_score: number
  seo_issues: EtsySeoIssue[]
  geo_insights: EtsyGeoInsights
  suggestions: EtsySeoSuggestions
  /** Kurzfazit für die UI */
  summary?: string
}

export type EtsyShopListingKurz = {
  listingId: number
  title: string
  state: string
  priceEur: number | null
  url: string | null
  tags: string[]
  views?: number | null
  numFavorers?: number | null
  updatedAt?: string | null
}

export type EtsyShopListingDetail = EtsyShopListingKurz & {
  description: string
  quantity: number | null
  taxonomyId: number | null
  materials: string[]
  whoMade: string | null
  whenMade: string | null
}

export type EtsyRankKeywordResult = {
  keyword: string
  page: number | null
  position: number | null
  found: boolean
  note?: string
}

export type EtsyRankTrackingResult = {
  listingId: number
  checkedAt: string
  results: EtsyRankKeywordResult[]
  provider: 'apify' | 'etsy_search' | 'unavailable'
}

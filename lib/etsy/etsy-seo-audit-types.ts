/** Typen für Etsy SEO & GEO Audit / Überwachung. */

import type { EtsyMarktAbdeckung } from '@/lib/etsy/etsy-markt-types'

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
  /** 0–100: Wie sicher KI-Suchen (Gemini/ChatGPT/Perplexity) das Listing einer Intent-Anfrage zuordnen können. */
  ai_search_score?: number
  /** Sprach-/Intent-Anfragen, die das Listing bereits klar beantwortet. */
  intent_queries_covered?: string[]
  /** Naheliegende Intent-Anfragen, für die Kontext fehlt. */
  intent_queries_missing?: string[]
}

export type EtsyAuditMarktZusammenfassung = {
  abdeckung: EtsyMarktAbdeckung
  keywordKandidaten: string[]
  preisMedianEur: number | null
  degradiert: boolean
  hinweise: string[]
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
  /** Markt-Abgleich (Autosuggest + Konkurrenz) zum Audit-Zeitpunkt */
  markt?: EtsyAuditMarktZusammenfassung
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
  /** `etsy_api_relevanz` = Etsy-Suchseite geblockt, Position aus Open-API-Relevanz (Proxy) */
  provider: 'apify' | 'etsy_search' | 'etsy_api_relevanz' | 'unavailable'
}

export type EtsyRankVerlust = {
  listingId: number
  keyword: string
  vorher: { page: number | null; position: number | null; found: boolean }
  jetzt: { page: number | null; position: number | null; found: boolean }
  checkedAt: string
}

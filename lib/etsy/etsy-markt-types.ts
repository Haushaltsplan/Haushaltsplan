/** Markt-Signale (Autosuggest + Konkurrenz) — client- und serverseitig nutzbar. */

export type EtsyMarktQuelle = 'live' | 'cache' | 'fallback'

export type EtsyAutosuggestErgebnis = {
  query: string
  suggestions: string[]
  /** `etsy_suggest` = Autosuggest-Endpoint, `competitor_tags` = aus Top-Listings abgeleitet, `seed` = Domain-Fallback */
  provider: 'etsy_suggest' | 'competitor_tags' | 'seed'
  quelle: EtsyMarktQuelle
  fetchedAt: string
  note?: string
}

export type EtsyCompetitorListing = {
  listingId: number
  title: string
  tags: string[]
  priceEur: number | null
  numFavorers: number | null
  url: string | null
  badges: string[]
}

export type EtsyTagFrequenz = { tag: string; count: number }

export type EtsyCompetitorInsights = {
  keyword: string
  /** `etsy_api` = Open API findAllListingsActive (Relevanz), `etsy_html` = Such-HTML/JSON-LD */
  provider: 'etsy_api' | 'etsy_html' | 'unavailable'
  quelle: EtsyMarktQuelle
  fetchedAt: string
  listings: EtsyCompetitorListing[]
  topTags: EtsyTagFrequenz[]
  topTitelPhrasen: EtsyTagFrequenz[]
  preis: {
    avg: number | null
    median: number | null
    min: number | null
    max: number | null
  }
  badgeAnteil: number | null
  /** Treffer gesamt laut API (Wettbewerbsgröße), null wenn unbekannt */
  wettbewerbCount: number | null
  note?: string
}

export type EtsyMarktKontext = {
  seeds: string[]
  autosuggest: EtsyAutosuggestErgebnis[]
  competitors: EtsyCompetitorInsights[]
  /** Dedupliziert, nach Relevanz sortiert — direkt als Tag-Kandidaten nutzbar (≤20 Zeichen) */
  keywordKandidaten: string[]
  degradiert: boolean
  hinweise: string[]
}

export type EtsyMarktAbdeckung = {
  abgedeckt: string[]
  fehlend: string[]
  quote: number
}

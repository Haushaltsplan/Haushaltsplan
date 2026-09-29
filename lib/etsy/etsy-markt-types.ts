/** Markt-Signale (Autosuggest + Konkurrenz) — client- und serverseitig nutzbar. */

export type EtsyMarktQuelle = 'live' | 'cache' | 'fallback'

export type EtsyAutosuggestErgebnis = {
  query: string
  suggestions: string[]
  /**
   * `etsy_suggest` = Etsy-Autosuggest, `google_de`/`amazon_de` = Suchvorschläge deutscher Käufer,
   * `competitor_tags` = aus Top-Listings abgeleitet, `seed` = Domain-Fallback
   */
  provider: 'etsy_suggest' | 'google_de' | 'amazon_de' | 'competitor_tags' | 'seed'
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
  /** `DE` = nur Shops aus Deutschland (Zielmarkt), `global` = Fallback bei zu wenig DE-Treffern */
  marktFilter?: 'DE' | 'global'
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
  /** Shop-eigene Signale (Merkliste, Top-Drechsler-Tags, Saison) — vom Cockpit angereichert */
  eigeneSignale?: EtsyEigeneSignale
}

export type EtsyEigeneSignale = {
  merkliste: string[]
  konkurrenzTags: Array<{ tag: string; shops: number }>
  konkurrenzShops: number
  saison: Array<{ name: string; tag: string }>
}

export type EtsyKeywordChance = 'hoch' | 'mittel' | 'niedrig'

/** Ergebnis des Keyword-Explorers (Etsy-Top-Listings + Google.de + Amazon.de + Etsy-Wettbewerb). */
export type EtsyKeywordIdee = {
  keyword: string
  /** 0–100: wie oft/weit oben die Phrase in Käufer-Suchvorschlägen / Etsy-Top-Tags auftaucht */
  nachfrage: number
  quellen: Array<'etsy_tags' | 'etsy_suggest' | 'google_de' | 'amazon_de'>
  /** Wie viele der Top-100-Etsy-Listings diese Phrase als Tag nutzen (null = kein Etsy-Tag). */
  etsyNutzung: number | null
  /** Aktive Etsy-Treffer (DE-Shops bevorzugt), null wenn nicht geprüft */
  wettbewerb: number | null
  wettbewerbMarkt: 'DE' | 'global' | null
  chance: EtsyKeywordChance | null
  /** ≤20 Zeichen → direkt als Etsy-Tag nutzbar */
  tagTauglich: boolean
  saison: string | null
}

export type EtsyKeywordExplorerErgebnis = {
  seed: string
  ideen: EtsyKeywordIdee[]
  abfragen: number
  hinweise: string[]
}

export type EtsyMarktAbdeckung = {
  abgedeckt: string[]
  fehlend: string[]
  quote: number
}

/** Erweiterte Fundamentaldaten (Tier 1–3) — Scraper-basiert, ohne Analysten-Ratings. */

import type { EarningsBeatMissPaket } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'

export type DividendenHistorieStat = {
  anzahlZahlungen: number
  jahreMitDaten: number
  letzteExDate: string | null
  letzteDividendeUsd: number | null
  frequenz: string | null
  cagr5yPct: number | null
  cagr10yPct: number | null
  jahreOhneSenkung: number | null
  letzteSenkungJahr: number | null
  durchschnittWachstum3yPct: number | null
  quelle: 'divvydiary'
}

export type YahooHoldersPaket = {
  insiderPct: number | null
  institutionenPct: number | null
  insiderShares: number | null
  institutionenShares: number | null
  floatShares: number | null
  sharesOutstanding: number | null
  quelle: 'yahoo'
}

export type FinvizErweitertPaket = {
  shortFloatPct: number | null
  shortRatio: number | null
  rsi14: number | null
  relVolume: number | null
  insiderOwnershipPct: number | null
  institutionalOwnershipPct: number | null
  peg: number | null
  quelle: 'finviz'
}

export type InsiderNettoPaket = {
  kaeufe90d: number
  verkaeufe90d: number
  nettoWertUsd90d: number | null
  nettoRichtung: 'kauf' | 'verkauf' | 'neutral' | null
  letzterTrade: string | null
  quelle: 'sec_edgar' | 'openinsider'
}

export type SecSegmentEintrag = {
  name: string
  anteilPct: number | null
  umsatzMio: number | null
  operatingIncomeMio?: number | null
  netIncomeMio?: number | null
  margePct?: number | null
}

export type SecStrukturPaket = {
  segmente: SecSegmentEintrag[]
  /** Produkt-/Geschäftssegmente (letztes FY). */
  segmenteProdukt: SecSegmentEintrag[]
  /** Geografische Umsatzsegmente (letztes FY). */
  segmenteGeo: SecSegmentEintrag[]
  segmentHinweis: string | null
  segmentArt: 'produkt' | 'geo' | null
  pensionVerpflichtungMio: number | null
  leaseVerpflichtungMio: number | null
  ceoVerguetungUsd: number | null
  proxyJahr: number | null
  berichtJahr: number | null
  quelle: 'sec_edgar'
}

export type SecSegmentHistorieJahr = {
  jahr: number
  segmente: SecSegmentEintrag[]
}

export type SecSegmentHistorie = {
  art: 'produkt' | 'geo' | 'geo_assets' | 'umsatz_detail' | 'produkte_services'
  jahre: SecSegmentHistorieJahr[]
  segmentNamen: string[]
  anzahlJahre: number
  aeltestesJahr: number
  juengstesJahr: number
}

export type SecSegmentHistorieKategorie = {
  id: string
  titel: string
  art: SecSegmentHistorie['art']
  metrik: 'umsatz' | 'assets'
  historie: SecSegmentHistorie
}

export type SecZusatzRisikoFelder = {
  mitarbeiterAnzahl: number | null
  auslandsumsatzAnteilPct: number | null
  hauptkunden: { name: string; anteilPct: number }[]
  /** Mitarbeiter pro Geschäftsjahr (aus 10-K-Text). */
  mitarbeiterHistorie: { jahr: number; anzahl: number }[]
  /** Größter Kundenanteil je Jahr (wenn in 10-K genannt). */
  kundenKonzentrationHistorie: { jahr: number; anteilPct: number; name: string | null }[]
}

export type SecBacklogEintrag = {
  jahr: number
  /** Wert in Mio. USD */
  wertMio: number
}

export type SecBacklogHistorie = {
  art: 'rpo' | 'backlog' | 'deferred_revenue'
  label: string
  quelleTag: string
  eintraege: SecBacklogEintrag[]
  anzahlJahre: number
  aeltestesJahr: number
  juengstesJahr: number
}

export type SecKennzahlJahr = { jahr: number; wert: number }

export type SecKennzahlenHistorie = {
  umsatzMio: SecKennzahlJahr[]
  nettogewinnMio: SecKennzahlJahr[]
  ebitMio: SecKennzahlJahr[]
  ebitMargePct: SecKennzahlJahr[]
  nettoMargePct: SecKennzahlJahr[]
  rndMio: SecKennzahlJahr[]
  rndAnteilPct: SecKennzahlJahr[]
  capexMio: SecKennzahlJahr[]
  capexAnteilPct: SecKennzahlJahr[]
  ocfMio: SecKennzahlJahr[]
  fcfMio: SecKennzahlJahr[]
  assetsMio: SecKennzahlJahr[]
  eigenkapitalMio: SecKennzahlJahr[]
  langfristigeSchuldenMio: SecKennzahlJahr[]
  mitarbeiter: SecKennzahlJahr[]
  goodwillMio: SecKennzahlJahr[]
  abschreibungMio: SecKennzahlJahr[]
  aktienrueckkaufMio: SecKennzahlJahr[]
  aeltestesJahr: number
  juengstesJahr: number
  anzahlJahre: number
}

export type SecSegmentHistoriePaket = {
  produkt: SecSegmentHistorie | null
  geo: SecSegmentHistorie | null
  /** Alle erkannten XBRL-Tabellen (Disaggregation, Geo-Assets, …). */
  kategorien: SecSegmentHistorieKategorie[]
  zusatz: SecZusatzRisikoFelder
  /** Backlog / RPO / Deferred Revenue (SEC XBRL + 10-K-Text). */
  backlog: SecBacklogHistorie | null
  kennzahlen: SecKennzahlenHistorie | null
  berichtJahr: number | null
  anzahl10k: number
  geladenAm: string
  quelle: 'sec_edgar'
}

export type EuFundamentalKennzahl = {
  label: string
  wert: string
}

export type EuFundamentalPaket = {
  kennzahlen: EuFundamentalKennzahl[]
  quelle: 'marketscreener' | 'wallstreet'
}

export type YahooOptionsIvPaket = {
  impliziteVolatilitaetPct: number | null
  atmStrike: number | null
  expiration: string | null
  quelle: 'yahoo_options'
}

export type PlattformBewertung = {
  /** Skala 1–5. */
  score: number | null
  anzahlBewertungen: number | null
  url: string | null
}

export type CeoZustimmung = {
  name: string | null
  /** 0–100 % CEO-Zustimmung (Glassdoor). */
  zustimmungPct: number | null
  url: string | null
}

export type ArbeitgeberBewertungPaket = {
  kununu: PlattformBewertung | null
  glassdoor: PlattformBewertung | null
  glassdoorCeo: CeoZustimmung | null
  hinweis: string | null
}

export type FundamentaldatenErweitert = {
  dividenden: DividendenHistorieStat | null
  holders: YahooHoldersPaket | null
  finviz: FinvizErweitertPaket | null
  insiderNetto: InsiderNettoPaket | null
  beatMiss: Pick<EarningsBeatMissPaket, 'agg12' | 'agg20' | 'streak' | 'epsBeatRatePct' | 'umsatzBeatRatePct'> | null
  secStruktur: SecStrukturPaket | null
  secSegmentHistorie: SecSegmentHistoriePaket | null
  euFundamental: EuFundamentalPaket | null
  optionsIv: YahooOptionsIvPaket | null
  arbeitgeber: ArbeitgeberBewertungPaket | null
  geladenAm: string
}

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
  quelle: 'openinsider'
}

export type SecSegmentEintrag = {
  name: string
  anteilPct: number | null
  umsatzMio: number | null
}

export type SecStrukturPaket = {
  segmente: SecSegmentEintrag[]
  segmentHinweis: string | null
  pensionVerpflichtungMio: number | null
  leaseVerpflichtungMio: number | null
  ceoVerguetungUsd: number | null
  proxyJahr: number | null
  berichtJahr: number | null
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

export type ArbeitgeberBewertungPaket = {
  score: number | null
  anzahlBewertungen: number | null
  plattform: 'kununu' | 'glassdoor' | null
  url: string | null
  hinweis: string | null
}

export type FundamentaldatenErweitert = {
  dividenden: DividendenHistorieStat | null
  holders: YahooHoldersPaket | null
  finviz: FinvizErweitertPaket | null
  insiderNetto: InsiderNettoPaket | null
  beatMiss: Pick<EarningsBeatMissPaket, 'agg12' | 'agg20' | 'streak' | 'epsBeatRatePct' | 'umsatzBeatRatePct'> | null
  secStruktur: SecStrukturPaket | null
  euFundamental: EuFundamentalPaket | null
  optionsIv: YahooOptionsIvPaket | null
  arbeitgeber: ArbeitgeberBewertungPaket | null
  geladenAm: string
}

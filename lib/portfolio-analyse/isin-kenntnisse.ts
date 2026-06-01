import type { BoersenWaehrung } from '@/lib/portfolio-analyse/kurs-aufloesung'

/** Manuelle Korrekturen, wenn ISIN-Lookup keinen Namen/Ticker liefert. */
export type IsinKenntnis = {
  name?: string
  wkn?: string
  symbolYahoo?: string
  symbolCandidates?: string[]
  /** Finnhub-Logo-Slug (oft ≠ Kursticker, z. B. HLMA statt H11.MU). */
  logoSymbol?: string
  /** Abweichende Währung pro Yahoo-Symbol (z. B. XDEW.L in USD). */
  symbolWaehrung?: Record<string, BoersenWaehrung>
  /** Nur dieses Yahoo-Symbol für den Live-Kurs (kein RCRS/CYBR o. Ä.). */
  kursNurSymbol?: string
  /** Yahoo-Symbole ignorieren (z. B. OSP2.HM statt USU). */
  verboteneSymbole?: string[]
  /** Stooq-Symbol (z. B. usu.de) wenn Yahoo fehlt oder falsch. */
  stooqSymbol?: string
  /** Fester EUR-Kurs, wenn Yahoo für kursNurSymbol keinen Treffer liefert. */
  kursFallbackEur?: number
}

export const ISIN_KENNTNISSE: Record<string, IsinKenntnis> = {
  US0404132054: {
    name: 'Arista Networks',
    wkn: 'A1J4UL',
    symbolYahoo: 'ANET',
    symbolCandidates: ['ANET', 'ANET.DE'],
  },
  US91680M1071: {
    name: 'Upstart Holdings',
    symbolYahoo: 'UPST',
    symbolCandidates: ['UPST'],
    logoSymbol: 'UPST',
  },
  GB0004052071: {
    name: 'Halma',
    symbolYahoo: 'H11.MU',
    symbolCandidates: ['H11.MU'],
    logoSymbol: 'HLMA',
  },
  CA15135U1093: {
    name: 'Alimentation Couche-Tard',
    symbolYahoo: 'ATD.TO',
    symbolCandidates: ['ATD.TO'],
    logoSymbol: 'ATD',
  },
  /** Alias falls andere Anteilsklasse/ISIN im Depot */
  CA015DM1098: {
    name: 'Alimentation Couche-Tard',
    symbolYahoo: 'ATD.TO',
    symbolCandidates: ['ATD.TO'],
    logoSymbol: 'ATD',
  },
  IE00BLNMYC90: {
    name: 'Xtrackers S&P 500 Equal Weight UCITS ETF 1C',
    symbolYahoo: 'XDEW.L',
    symbolCandidates: ['XDEW.L'],
    symbolWaehrung: { 'XDEW.L': 'USD' },
  },
  IE00BJXRZJ40: {
    name: 'Rize Cybersecurity and Data Privacy UCITS ETF',
    symbolYahoo: 'IE00BJXRZJ40.SG',
    symbolCandidates: ['IE00BJXRZJ40.SG'],
    kursNurSymbol: 'IE00BJXRZJ40.SG',
    symbolWaehrung: { 'IE00BJXRZJ40.SG': 'EUR' },
  },
  DE000A0BVU28: {
    name: 'USU Software',
    wkn: 'A0BVU2',
    symbolYahoo: 'OSP2.HM',
    symbolCandidates: ['OSP2.HM'],
    kursNurSymbol: 'OSP2.HM',
    symbolWaehrung: { 'OSP2.HM': 'EUR' },
    kursFallbackEur: 9.1,
    logoSymbol: 'USU',
  },
  /** Datadog Inc. Class A (Trade Republic / Parqet) */
  US23804L1035: {
    name: 'Datadog',
    symbolYahoo: 'DDOG',
    symbolCandidates: ['DDOG'],
    kursNurSymbol: 'DDOG',
    logoSymbol: 'DDOG',
  },
}

export function isinKenntnis(isin: string | null | undefined): IsinKenntnis | null {
  if (!isin) return null
  return ISIN_KENNTNISSE[isin.trim().toUpperCase()] ?? null
}

export function nameAusKenntnis(isin: string, fallback: string): string {
  const k = isinKenntnis(isin)
  if (k?.name) return k.name
  return fallback
}

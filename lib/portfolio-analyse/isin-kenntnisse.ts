import type { BoersenWaehrung } from '@/lib/portfolio-analyse/kurs-aufloesung'

/** Manuelle Korrekturen, wenn ISIN-Lookup keinen Namen/Ticker liefert. */
export type IsinKenntnis = {
  name?: string
  wkn?: string
  symbolYahoo?: string
  symbolCandidates?: string[]
  /** Abweichende Währung pro Yahoo-Symbol (z. B. XDEW.L in USD). */
  symbolWaehrung?: Record<string, BoersenWaehrung>
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
  },
  GB0004052071: {
    name: 'Halma',
    symbolYahoo: 'H11.MU',
    symbolCandidates: ['H11.MU'],
  },
  CA15135U1093: {
    name: 'Alimentation Couche-Tard',
    symbolYahoo: 'ATD.TO',
    symbolCandidates: ['ATD.TO'],
  },
  /** Alias falls andere Anteilsklasse/ISIN im Depot */
  CA015DM1098: {
    name: 'Alimentation Couche-Tard',
    symbolYahoo: 'ATD.TO',
    symbolCandidates: ['ATD.TO'],
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

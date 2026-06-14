import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import { ASSET_KLASSE_LABEL, type AssetKlasse } from '@/lib/portfolio-analyse/types'

/** Manuelle Sektor-Zuordnung (GICS-ähnlich) — erweiterbar. */
const ISIN_SEKTOR: Record<string, string> = {
  US23804L1035: 'Technologie',
  US0404132054: 'Technologie',
  US91680M1071: 'Finanzdienstleistungen',
  GB0004052071: 'Industrie',
  IE00BLNMYC90: 'ETF & Fonds',
  IE00BJXRZJ40: 'ETF & Fonds',
  DE000A0BVU28: 'Technologie',
}

const KLASSE_FALLBACK: Record<AssetKlasse, string> = {
  aktie: 'Aktien',
  etf: 'ETF & Fonds',
  anleihe: 'Anleihen',
  crypto: 'Krypto',
  geldmarkt: 'Geldmarkt',
  sonstiges: 'Andere',
}

export function isinSektorName(isin: string | null | undefined): string | undefined {
  if (!isin) return undefined
  return ISIN_SEKTOR[isin.trim().toUpperCase()]
}

export function sektorFuerPosition(p: LivePosition): string {
  const isin = p.isin?.toUpperCase()
  if (isin && ISIN_SEKTOR[isin]) return ISIN_SEKTOR[isin]
  return KLASSE_FALLBACK[p.assetKlasse] ?? ASSET_KLASSE_LABEL[p.assetKlasse]
}

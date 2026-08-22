import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { FundamentalSektorLookup } from '@/lib/portfolio-analyse/sektor-fundamental-client'
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

export function sektorAusLookup(
  isin: string | null | undefined,
  symbolYahoo: string | null | undefined,
  lookup?: FundamentalSektorLookup,
): string | null {
  if (!lookup) return null
  const i = isin?.trim().toUpperCase()
  if (i && lookup.byIsin.has(i)) return lookup.byIsin.get(i)!
  const sym = symbolYahoo?.trim().toUpperCase()
  if (sym) {
    return lookup.bySymbol.get(sym) ?? lookup.bySymbol.get(sym.split('.')[0]!) ?? null
  }
  return null
}

export function isinSektorName(
  isin: string | null | undefined,
  lookup?: FundamentalSektorLookup,
): string | undefined {
  if (!isin) return undefined
  const key = isin.trim().toUpperCase()
  const ausLookup = lookup?.byIsin.get(key)
  if (ausLookup) return ausLookup
  return ISIN_SEKTOR[key]
}

export function sektorFuerPosition(p: LivePosition, lookup?: FundamentalSektorLookup): string {
  const ausLookup = sektorAusLookup(p.isin, p.symbolYahoo, lookup)
  if (ausLookup) return ausLookup
  const isin = p.isin?.toUpperCase()
  if (isin && ISIN_SEKTOR[isin]) return ISIN_SEKTOR[isin]
  return KLASSE_FALLBACK[p.assetKlasse] ?? ASSET_KLASSE_LABEL[p.assetKlasse]
}

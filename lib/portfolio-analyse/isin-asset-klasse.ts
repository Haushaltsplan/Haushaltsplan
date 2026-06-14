import type { AssetKlasse } from '@/lib/portfolio-analyse/types'

/** Bekannte ETF-ISINs im Depot (UCITS). */
export const BEKANNTE_ETF_ISINS = new Set([
  'LU1681038243',
  'LU1681048804',
  'IE00BLNMYC90',
  'IE00BJXRZJ40',
])

export function istBekannterEtfIsin(isin: string | null | undefined): boolean {
  const id = isin?.trim().toUpperCase()
  return id != null && BEKANNTE_ETF_ISINS.has(id)
}

/** Korrigiert historisch falsche Importe (z. B. alle DE-ISINs als ETF). */
export function korrigiereAssetKlasse(
  isin: string | null | undefined,
  name: string | null | undefined,
  stored: AssetKlasse,
): AssetKlasse {
  const id = isin?.trim().toUpperCase()
  if (id && istBekannterEtfIsin(id)) return 'etf'

  const n = (name ?? '').toLowerCase()
  if (/etf|index|ucits|ishares|vanguard|xtrackers|amundi|lyxor|spdr/i.test(n)) return 'etf'

  if (stored === 'etf' && id) {
    if (id.startsWith('DE') || id.startsWith('FR') || id.startsWith('NL') || id.startsWith('CH')) {
      return 'aktie'
    }
    if (!istBekannterEtfIsin(id)) return 'aktie'
  }

  return stored
}

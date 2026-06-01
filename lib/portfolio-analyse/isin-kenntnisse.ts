/** Manuelle Korrekturen, wenn ISIN-Lookup keinen Namen/Ticker liefert. */
export type IsinKenntnis = {
  name?: string
  wkn?: string
  symbolYahoo?: string
  symbolCandidates?: string[]
}

export const ISIN_KENNTNISSE: Record<string, IsinKenntnis> = {
  US0404132054: {
    name: 'Arista Networks',
    wkn: 'A1J4UL',
    symbolYahoo: 'ANET',
    symbolCandidates: ['ANET', 'ANET.DE'],
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

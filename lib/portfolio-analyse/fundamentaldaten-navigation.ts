export const FUNDAMENTALDATEN_PFAD = '/portfolioanalyse/fundamentaldaten'
export const WATCHLIST_PFAD = '/portfolioanalyse/watchlist'

export type FundamentalKandidat = {
  isin: string | null
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  quelle: 'depot' | 'watchlist'
}

export function fundamentaldatenHref(opts: {
  isin?: string | null
  symbol?: string | null
}): string {
  const params = new URLSearchParams()
  const isin = opts.isin?.trim().toUpperCase()
  if (isin) params.set('isin', isin)
  else {
    const symbol = opts.symbol?.trim()
    if (symbol) params.set('symbol', symbol)
  }
  const q = params.toString()
  return q ? `${FUNDAMENTALDATEN_PFAD}?${q}` : FUNDAMENTALDATEN_PFAD
}

export function watchlistHref(opts: { isin?: string | null } = {}): string {
  const isin = opts.isin?.trim().toUpperCase()
  if (!isin) return WATCHLIST_PFAD
  return `${WATCHLIST_PFAD}?isin=${encodeURIComponent(isin)}`
}

export function findeFundamentalPositionIdx(
  positionen: Array<{ isin: string | null; symbolYahoo?: string | null; name?: string }>,
  opts: { isin?: string | null; symbol?: string | null },
): number {
  const isin = opts.isin?.trim().toUpperCase()
  if (isin) {
    const idx = positionen.findIndex((p) => p.isin?.trim().toUpperCase() === isin)
    if (idx >= 0) return idx
  }
  const symbol = opts.symbol?.trim().toUpperCase()
  if (symbol) {
    const idx = positionen.findIndex((p) => p.symbolYahoo?.trim().toUpperCase() === symbol)
    if (idx >= 0) return idx
  }
  return -1
}

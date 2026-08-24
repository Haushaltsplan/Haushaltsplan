import type {
  FundamentalGuvQuelle,
  FundamentalSchaetzungQuelle,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export function labelFundamentalGuvQuelle(
  q: FundamentalGuvQuelle | null | undefined,
): string | null {
  if (!q) return null
  if (q === 'macrotrends') return 'Macrotrends'
  if (q === 'eu') return 'EU-Berichte'
  if (q === 'marketscreener') return 'MarketScreener'
  return 'Yahoo'
}

export function labelFundamentalSchaetzungQuelle(
  q: FundamentalSchaetzungQuelle | null | undefined,
): string | null {
  if (!q) return null
  if (q === 'stockanalysis') return 'StockAnalysis'
  if (q === 'marketscreener') return 'MarketScreener'
  if (q === 'wallstreet') return 'Wallstreet'
  if (q === 'finnhub') return 'Finnhub'
  if (q === 'kombiniert') return 'gemischt'
  return 'Yahoo'
}

export function fundamentalQuellenZeile(opts: {
  guvQuelle?: FundamentalGuvQuelle | null
  schaetzungQuelle?: FundamentalSchaetzungQuelle | null
  fallbackPaketQuelle?: 'macrotrends' | 'yahoo' | 'marketscreener' | null
}): string | null {
  const guv =
    labelFundamentalGuvQuelle(opts.guvQuelle) ??
    labelFundamentalGuvQuelle(
      opts.fallbackPaketQuelle === 'yahoo'
        ? 'yahoo'
        : opts.fallbackPaketQuelle === 'marketscreener'
          ? 'marketscreener'
          : opts.fallbackPaketQuelle === 'macrotrends'
            ? 'macrotrends'
            : null,
    )
  const schaetz = labelFundamentalSchaetzungQuelle(opts.schaetzungQuelle)
  const teile: string[] = []
  if (guv) teile.push(`GuV: ${guv}`)
  if (schaetz) teile.push(`Schätzung: ${schaetz}`)
  return teile.length > 0 ? teile.join(' · ') : null
}

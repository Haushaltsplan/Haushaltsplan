/** Orchestrierung: Marketscreener Segmente + MarketBeat/StockAnalysis Backlog (kein SEC). */

import 'server-only'

import type { SecSegmentHistoriePaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeMarketbeatBacklogHistorie } from '@/lib/portfolio-analyse/marketbeat-backlog-server'
import { ladeMarketscreenerSegmentHistorie } from '@/lib/portfolio-analyse/marketscreener-segment-historie-server'
import { ladeStockanalysisBacklogHistorie } from '@/lib/portfolio-analyse/stockanalysis-backlog-server'

function usTicker(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
}): string | null {
  for (const sym of [opts.ticker, opts.symbolYahoo]) {
    const t = sym?.trim().toUpperCase()
    if (t && !t.includes('.')) return t.split('.')[0]!
  }
  return null
}

async function ergaenzeBacklog(
  paket: SecSegmentHistoriePaket,
  opts: {
    ticker?: string | null
    symbolYahoo?: string | null
    isin?: string | null
  },
): Promise<SecSegmentHistoriePaket> {
  if (paket.backlog) return paket
  const ticker = usTicker(opts)
  const [mb, sa] = await Promise.all([
    ticker ? ladeMarketbeatBacklogHistorie(ticker) : Promise.resolve(null),
    ladeStockanalysisBacklogHistorie(opts),
  ])
  const backlog = sa && mb ? (sa.anzahlJahre >= mb.anzahlJahre ? sa : mb) : sa ?? mb
  if (!backlog) return paket
  return { ...paket, backlog }
}

export async function ladeGescrapteSegmentStruktur(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
}): Promise<SecSegmentHistoriePaket | null> {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })

  if (!isin && !opts.name?.trim() && !opts.symbolYahoo && !opts.ticker) return null

  const paket = await ladeMarketscreenerSegmentHistorie({
    isin: isin ?? opts.isin,
    name: opts.name,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
  })
  if (!paket) return null
  return ergaenzeBacklog(paket, { ...opts, isin })
}

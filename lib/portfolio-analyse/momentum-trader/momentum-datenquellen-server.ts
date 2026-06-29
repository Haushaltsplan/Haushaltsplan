import 'server-only'

import type { MomentumDatenquelle } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type { MomentumDatenquelle }

/** Welche externen Quellen der Momentum Trader nutzt. */
export function momentumDatenquellenStatus(): MomentumDatenquelle[] {
  const finnhub = Boolean((process.env.FINNHUB_API_KEY ?? '').trim())
  return [
    {
      id: 'yahoo-ohlcv',
      name: 'Yahoo Finance (Kurse)',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'OHLCV, Gap, RVOL, RS vs. S&P',
    },
    {
      id: 'yahoo-earnings',
      name: 'Yahoo Finance (Earnings)',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Termine, BMO/AMC, EPS-Historie (Fallback)',
    },
    {
      id: 'divvydiary',
      name: 'DivvyDiary',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Kalender + Historie (Watchlist)',
    },
    {
      id: 'finnhub',
      name: 'Finnhub',
      typ: 'api',
      aktiv: finnhub,
      nutzen: finnhub
        ? 'BMO/AMC, EPS-Surprise, IPO-Datum'
        : 'Optional — FINNHUB_API_KEY fehlt (Surprise/IPO schwächer)',
    },
  ]
}

import 'server-only'

import type { MomentumDatenquelle } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type { MomentumDatenquelle }

/** Alle Quellen sind Scraper — keine API-Keys nötig. */
export function momentumDatenquellenStatus(): MomentumDatenquelle[] {
  return [
    {
      id: 'yahoo-ohlcv',
      name: 'Yahoo Finance',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'OHLCV (US + Indizes ^GSPC/^VIX)',
    },
    {
      id: 'stooq',
      name: 'Stooq.com',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'OHLCV EU/US (CSV, Lückenfüller)',
    },
    {
      id: 'divvydiary',
      name: 'DivvyDiary',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Kalender + Historie',
    },
    {
      id: 'marketbeat',
      name: 'MarketBeat.com',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Termine, BMO/AMC, EPS-Surprise, IPO',
    },
    {
      id: 'wallstreet',
      name: 'Wallstreet-Online',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Termine (EU)',
    },
    {
      id: 'yahoo-earnings',
      name: 'Yahoo quoteSummary',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Termin, BMO/AMC, Surprise-Fallback, IPO-Fallback',
    },
  ]
}

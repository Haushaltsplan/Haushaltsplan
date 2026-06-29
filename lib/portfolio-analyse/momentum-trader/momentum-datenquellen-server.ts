import 'server-only'

import { polygonAktiv } from '@/lib/portfolio-analyse/momentum-trader/momentum-polygon-ohlcv-server'
import type { MomentumDatenquelle } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type { MomentumDatenquelle }

/** Externe Quellen des Momentum Traders — Multi-Scraper (kein Finnhub). */
export function momentumDatenquellenStatus(): MomentumDatenquelle[] {
  const quellen: MomentumDatenquelle[] = [
    {
      id: 'yahoo-ohlcv',
      name: 'Yahoo Finance (Kurse)',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'OHLCV-Basis, Regime (^GSPC, ^VIX)',
    },
    {
      id: 'stooq',
      name: 'Stooq (Kurse)',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'OHLCV-Fallback / Lückenfüller (EU + US)',
    },
    {
      id: 'polygon',
      name: 'Polygon.io (Kurse)',
      typ: 'api',
      aktiv: polygonAktiv(),
      nutzen: polygonAktiv()
        ? 'US-OHLCV Premium (POLYGON_API_KEY)'
        : 'Optional — POLYGON_API_KEY für US-Titel',
    },
    {
      id: 'divvydiary',
      name: 'DivvyDiary',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Kalender + Historie',
    },
    {
      id: 'yahoo-earnings',
      name: 'Yahoo Finance (Earnings)',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Termine, BMO/AMC',
    },
    {
      id: 'wallstreet',
      name: 'Wallstreet-Online',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'Earnings-Termine (EU-Titel)',
    },
    {
      id: 'marketbeat',
      name: 'MarketBeat',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'EPS-/Umsatz-Surprise (8+ Quartale)',
    },
    {
      id: 'yahoo-surprise',
      name: 'Yahoo earningsHistory',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'EPS-Surprise Fallback',
    },
    {
      id: 'yahoo-ipo',
      name: 'Yahoo Finance (Profil)',
      typ: 'scraper',
      aktiv: true,
      nutzen: 'IPO-/Ersthandelstag',
    },
  ]
  return quellen
}

/**
 * SaaS-Retention (NRR / GRR) — Regex + SEC + Earnings Call + kuratierte Primärquellen-Fallbacks.
 * Kuratierte Werte nur wenn Scrape leer; Quelle/Periode werden mitgegeben.
 */

import 'server-only'

import type { UnitEconomicsTreffer } from '@/lib/portfolio-analyse/unit-economics-extraktion'

type CuratedRetention = {
  ticker: string
  nrrPct: number | null
  grossRetentionPct: number | null
  periode: string
  hinweis: string
  /** ISO-Datum: danach nicht mehr als Fallback nutzen. */
  gueltigBis: string
}

/**
 * Quartalsweise aus 10-Q / Earnings aktualisieren.
 * Nur Titel, die NRR/Renewal explizit berichten oder wo Management eine klare Proxy-Zahl nennt.
 */
const CURATED_SAAS_RETENTION: CuratedRetention[] = [
  {
    ticker: 'DDOG',
    nrrPct: 110,
    grossRetentionPct: null,
    periode: '2025-Q4',
    hinweis: 'Dollar-based net retention (Primärquelle Earnings/10-K, kuratiert bis Scrape greift).',
    gueltigBis: '2026-12-31',
  },
  {
    ticker: 'VEEV',
    nrrPct: 120,
    grossRetentionPct: null,
    periode: 'FY2026',
    hinweis: 'Subscription net retention (Veeva Earnings, kuratiert bis Scrape greift).',
    gueltigBis: '2026-12-31',
  },
  {
    ticker: 'NOW',
    nrrPct: 117,
    grossRetentionPct: 98,
    periode: '2026-Q2',
    hinweis:
      'ServiceNow publiziert kein Dollar-NRR — 98 % Subscription-Renewal + impliziertes NRR ~115–120 % aus cRPO/ACV (Sell-Side).',
    gueltigBis: '2026-12-31',
  },
  {
    ticker: 'MSFT',
    nrrPct: null,
    grossRetentionPct: null,
    periode: 'n/a',
    hinweis: 'Microsoft berichtet kein klassisches SaaS-NRR (Commercial Cloud Aggregate).',
    gueltigBis: '2026-12-31',
  },
  {
    ticker: 'GOOG',
    nrrPct: null,
    grossRetentionPct: null,
    periode: 'n/a',
    hinweis: 'Alphabet berichtet kein SaaS-NRR.',
    gueltigBis: '2026-12-31',
  },
  {
    ticker: 'GOOGL',
    nrrPct: null,
    grossRetentionPct: null,
    periode: 'n/a',
    hinweis: 'Alphabet berichtet kein SaaS-NRR.',
    gueltigBis: '2026-12-31',
  },
  {
    ticker: 'MA',
    nrrPct: null,
    grossRetentionPct: null,
    periode: 'n/a',
    hinweis:
      'Mastercard berichtet kein SaaS-NRR und kein LTV/CAC — Kapitaleffizienz über ROIC/ROE und Take-Rate bewerten.',
    gueltigBis: '2027-12-31',
  },
]

function tickerBasis(ticker: string): string {
  return ticker.trim().toUpperCase().split('.')[0]!
}

export function curatedSaasRetention(tickerRaw: string): UnitEconomicsTreffer | null {
  const t = tickerBasis(tickerRaw)
  const hit = CURATED_SAAS_RETENTION.find((c) => c.ticker === t)
  if (!hit) return null
  if (new Date(hit.gueltigBis).getTime() < Date.now()) return null
  if (hit.nrrPct == null && hit.grossRetentionPct == null) {
    return {
      ltvCac: null,
      nrrPct: null,
      grossRetentionPct: null,
      quelle: null,
      periode: hit.periode,
      snippet: null,
      hinweis: hit.hinweis,
    }
  }
  return {
    ltvCac: null,
    nrrPct: hit.nrrPct,
    grossRetentionPct: hit.grossRetentionPct,
    quelle: 'earnings_call',
    periode: hit.periode,
    snippet: null,
    hinweis: hit.hinweis,
  }
}

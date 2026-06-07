import 'server-only'

import {
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

type TrendZeile = Record<string, unknown> & { period?: string }

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as { raw?: number }).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function periodEndLabel(row: TrendZeile): string {
  const end = row.endDate as { fmt?: string; raw?: number } | string | undefined
  if (typeof end === 'string' && /^\d{4}/.test(end)) {
    return `FY${end.slice(2, 4)}E`
  }
  if (end && typeof end === 'object' && end.fmt) {
    const m = end.fmt.match(/^(\d{4})/)
    return m ? `FY${m[1].slice(2)}E` : 'Schätzung'
  }
  return 'Schätzung'
}

async function fetchTrend(symbol: string): Promise<TrendZeile[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'earningsTrend')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const j = (await res.json()) as {
    quoteSummary?: { result?: Array<{ earningsTrend?: { trend?: TrendZeile[] } }> }
  }
  return j.quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
}

export type FundamentalSchaetzungenRoh = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
}

export async function ladeFundamentalSchaetzungen(symbol: string): Promise<FundamentalSchaetzungenRoh> {
  const trend = await fetchTrend(symbol)
  const fy0 = trend.find((t) => t.period === '0y')
  const fy1 = trend.find((t) => t.period === '+1y')

  const perioden: FundamentalPeriode[] = []
  const zeilen: FundamentalMetrikZeile[] = []

  if (!fy0 && !fy1) return { perioden, zeilen }

  if (fy0) {
    perioden.push({
      iso: FUNDAMENTAL_FY0E_KEY,
      label: periodEndLabel(fy0),
      istSchaetzung: true,
    })
  }
  if (fy1) {
    perioden.push({
      iso: FUNDAMENTAL_FY1E_KEY,
      label: periodEndLabel(fy1),
      istSchaetzung: true,
    })
  }

  const revEst0 = fy0?.revenueEstimate as Record<string, unknown> | undefined
  const revEst1 = fy1?.revenueEstimate as Record<string, unknown> | undefined
  const epsEst0 = fy0?.earningsEstimate as Record<string, unknown> | undefined
  const epsEst1 = fy1?.earningsEstimate as Record<string, unknown> | undefined

  const umsatzWerte: Record<string, number | null> = {}
  const epsWerte: Record<string, number | null> = {}
  const umsatzWachstum: Record<string, number | null> = {}
  const epsWachstum: Record<string, number | null> = {}

  if (fy0) {
    const rev0 = rawUnix(revEst0?.avg)
    umsatzWerte[FUNDAMENTAL_FY0E_KEY] = rev0 != null ? rev0 / 1_000_000 : null
    epsWerte[FUNDAMENTAL_FY0E_KEY] = rawUnix(epsEst0?.avg)
    const rg = rawUnix(revEst0?.growth)
    const eg = rawUnix(epsEst0?.growth)
    umsatzWachstum[FUNDAMENTAL_FY0E_KEY] = rg != null ? rg * 100 : null
    epsWachstum[FUNDAMENTAL_FY0E_KEY] = eg != null ? eg * 100 : null
  }
  if (fy1) {
    const rev1 = rawUnix(revEst1?.avg)
    umsatzWerte[FUNDAMENTAL_FY1E_KEY] = rev1 != null ? rev1 / 1_000_000 : null
    epsWerte[FUNDAMENTAL_FY1E_KEY] = rawUnix(epsEst1?.avg)
    const rg = rawUnix(revEst1?.growth)
    const eg = rawUnix(epsEst1?.growth)
    umsatzWachstum[FUNDAMENTAL_FY1E_KEY] = rg != null ? rg * 100 : null
    epsWachstum[FUNDAMENTAL_FY1E_KEY] = eg != null ? eg * 100 : null
  }

  zeilen.push(
    {
      id: 'umsatz_schaetzung',
      label: 'Umsatz (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: umsatzWerte,
      istSchaetzung: true,
    },
    {
      id: 'eps_schaetzung',
      label: 'EPS (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_aktie',
      werte: epsWerte,
      istSchaetzung: true,
    },
    {
      id: 'umsatz_wachstum_schaetzung',
      label: 'Umsatz-Wachstum (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'prozent',
      werte: umsatzWachstum,
      istSchaetzung: true,
    },
    {
      id: 'eps_wachstum_schaetzung',
      label: 'EPS-Wachstum (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'prozent',
      werte: epsWachstum,
      istSchaetzung: true,
    },
  )

  return { perioden, zeilen }
}

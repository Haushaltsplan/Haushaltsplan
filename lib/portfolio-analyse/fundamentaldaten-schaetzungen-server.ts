import 'server-only'

import { ladeFinnhubJahresForecast } from '@/lib/portfolio-analyse/finnhub-jahres-schaetzungen-server'
import {
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
  fundamentalSchaetzungIso,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { ladeMarketscreenerJahresForecast } from '@/lib/portfolio-analyse/marketscreener-jahres-consensus-server'
import {
  ladeStockanalysisJahresForecast,
  type StockanalysisJahresForecastEintrag,
} from '@/lib/portfolio-analyse/stockanalysis-forecast-server'
import { ladeWallstreetEarningsSchaetzungen } from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

type TrendZeile = Record<string, unknown> & { period?: string }

export type FundamentalSchaetzungenAnfrage = {
  symbol: string
  isin?: string | null
  name?: string | null
  ticker?: string | null
}

export type FundamentalSchaetzungenRoh = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  /** Primäre Schätzungsquelle (Yahoo nur bei Fallback). */
  quelle?: 'stockanalysis' | 'marketscreener' | 'wallstreet' | 'finnhub' | 'yahoo' | 'kombiniert'
}

function rawUnix(v: unknown): number | null {
  if (v == null || typeof v !== 'object') return null
  const raw = (v as { raw?: number }).raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function periodEndLabel(jahr: number | null, fallback: string): string {
  if (jahr != null && jahr > 2000) return `FY${String(jahr).slice(2)}E`
  return fallback
}

function pick<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) {
    if (v != null) return v
  }
  return null
}

function wachstumPct(neu: number | null, alt: number | null): number | null {
  if (neu == null || alt == null || alt === 0) return null
  const w = ((neu - alt) / Math.abs(alt)) * 100
  return Number.isFinite(w) ? w : null
}

type MergeFy = {
  jahr: number | null
  umsatzMio: number | null
  eps: number | null
  umsatzWachstumPct: number | null
  epsWachstumPct: number | null
}

async function ladeYahooTrend(symbol: string): Promise<{
  fy0: MergeFy
  fy1: MergeFy
} | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'earningsTrend')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return null

  const j = (await res.json()) as {
    quoteSummary?: { result?: Array<{ earningsTrend?: { trend?: TrendZeile[] } }> }
  }
  const trend = j.quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
  const fy0 = trend.find((t) => t.period === '0y')
  const fy1 = trend.find((t) => t.period === '+1y')
  if (!fy0 && !fy1) return null

  function ausTrend(row: TrendZeile | undefined): MergeFy {
    if (!row) {
      return { jahr: null, umsatzMio: null, eps: null, umsatzWachstumPct: null, epsWachstumPct: null }
    }
    const revEst = row.revenueEstimate as Record<string, unknown> | undefined
    const epsEst = row.earningsEstimate as Record<string, unknown> | undefined
    const end = row.endDate as { fmt?: string } | undefined
    const jahr = end?.fmt?.match(/^(\d{4})/)?.[1] ? Number(end.fmt.slice(0, 4)) : null
    const rev = rawUnix(revEst?.avg)
    const rg = rawUnix(revEst?.growth)
    const eg = rawUnix(epsEst?.growth)
    return {
      jahr,
      umsatzMio: rev != null ? rev / 1_000_000 : null,
      eps: rawUnix(epsEst?.avg),
      umsatzWachstumPct: rg != null ? rg * 100 : null,
      epsWachstumPct: eg != null ? eg * 100 : null,
    }
  }

  return { fy0: ausTrend(fy0), fy1: ausTrend(fy1) }
}

function baueRohAusStockanalysisReihe(
  eintraege: StockanalysisJahresForecastEintrag[],
): FundamentalSchaetzungenRoh {
  const schaetz = eintraege.filter((e) => e.istSchätzung)
  if (schaetz.length === 0) return { perioden: [], zeilen: [] }

  const perioden: FundamentalPeriode[] = schaetz.map((e, i) => ({
    iso: fundamentalSchaetzungIso(e.jahr, i),
    label: periodEndLabel(e.jahr, `FY${i}E`),
    istSchaetzung: true,
  }))

  function werteMap(
    pick: (e: StockanalysisJahresForecastEintrag) => number | null,
    skaliere?: (v: number) => number,
  ): Record<string, number | null> {
    const out: Record<string, number | null> = {}
    schaetz.forEach((e, i) => {
      const raw = pick(e)
      const iso = fundamentalSchaetzungIso(e.jahr, i)
      out[iso] = raw != null ? (skaliere ? skaliere(raw) : raw) : null
    })
    return out
  }

  const zeilen: FundamentalMetrikZeile[] = [
    {
      id: 'umsatz_schaetzung',
      label: 'Umsatz (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.umsatzUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'ebit_schaetzung',
      label: 'EBIT (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.operatingIncomeUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'nettogewinn_schaetzung',
      label: 'Nettogewinn (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.netIncomeUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'fcf_schaetzung',
      label: 'Free Cashflow (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.freeCashFlowUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'bruttogewinn_schaetzung',
      label: 'Bruttogewinn (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_mio',
      werte: werteMap((e) => e.grossProfitUsd, (v) => v / 1_000_000),
      istSchaetzung: true,
    },
    {
      id: 'eps_schaetzung',
      label: 'EPS (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'waehrung_usd_aktie',
      werte: werteMap((e) => e.eps),
      istSchaetzung: true,
    },
    {
      id: 'umsatz_wachstum_schaetzung',
      label: 'Umsatz-Wachstum (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'prozent',
      werte: werteMap((e) => e.revenueGrowthPct),
      istSchaetzung: true,
    },
    {
      id: 'eps_wachstum_schaetzung',
      label: 'EPS-Wachstum (Schätzung)',
      gruppe: 'schaetzungen',
      einheit: 'prozent',
      werte: werteMap((e) => e.epsGrowthPct),
      istSchaetzung: true,
    },
  ]

  return { perioden, zeilen, quelle: 'stockanalysis' }
}

function baueRohAusMerge(
  fy0: MergeFy,
  fy1: MergeFy,
  quelle: FundamentalSchaetzungenRoh['quelle'],
): FundamentalSchaetzungenRoh {
  const perioden: FundamentalPeriode[] = []
  const hatFy0 = fy0.umsatzMio != null || fy0.eps != null
  const hatFy1 = fy1.umsatzMio != null || fy1.eps != null

  if (hatFy0) {
    perioden.push({
      iso: FUNDAMENTAL_FY0E_KEY,
      label: periodEndLabel(fy0.jahr, 'FY0E'),
      istSchaetzung: true,
    })
  }
  if (hatFy1) {
    perioden.push({
      iso: FUNDAMENTAL_FY1E_KEY,
      label: periodEndLabel(fy1.jahr, 'FY1E'),
      istSchaetzung: true,
    })
  }

  const umsatzWerte: Record<string, number | null> = {}
  const epsWerte: Record<string, number | null> = {}
  const umsatzWachstum: Record<string, number | null> = {}
  const epsWachstum: Record<string, number | null> = {}

  if (hatFy0) {
    umsatzWerte[FUNDAMENTAL_FY0E_KEY] = fy0.umsatzMio
    epsWerte[FUNDAMENTAL_FY0E_KEY] = fy0.eps
    umsatzWachstum[FUNDAMENTAL_FY0E_KEY] = fy0.umsatzWachstumPct
    epsWachstum[FUNDAMENTAL_FY0E_KEY] = fy0.epsWachstumPct
  }
  if (hatFy1) {
    umsatzWerte[FUNDAMENTAL_FY1E_KEY] = fy1.umsatzMio
    epsWerte[FUNDAMENTAL_FY1E_KEY] = fy1.eps
    umsatzWachstum[FUNDAMENTAL_FY1E_KEY] = fy1.umsatzWachstumPct
    epsWachstum[FUNDAMENTAL_FY1E_KEY] = fy1.epsWachstumPct
  }

  const zeilen: FundamentalMetrikZeile[] = [
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
  ]

  return { perioden, zeilen, quelle }
}

export async function ladeFundamentalSchaetzungen(
  anfrage: FundamentalSchaetzungenAnfrage | string,
): Promise<FundamentalSchaetzungenRoh> {
  const opts: FundamentalSchaetzungenAnfrage =
    typeof anfrage === 'string' ? { symbol: anfrage } : anfrage
  const symbol = opts.symbol.trim()
  if (!symbol) return { perioden: [], zeilen: [] }

  const isin = opts.isin?.trim().toUpperCase() ?? ''
  const name = opts.name?.trim() ?? ''
  const ticker = opts.ticker?.trim() ?? ''

  const [stockanalysis, marketscreener, wallstreet, finnhub, yahoo] = await Promise.all([
    ladeStockanalysisJahresForecast({
      symbolYahoo: symbol,
      ticker: ticker || undefined,
      firmenname: name || undefined,
      isin: isin || undefined,
    }),
    isin.length >= 10
      ? ladeMarketscreenerJahresForecast(isin, name, symbol)
      : Promise.resolve(null),
    isin.length >= 10 ? ladeWallstreetEarningsSchaetzungen(isin, name) : Promise.resolve(null),
    ladeFinnhubJahresForecast(symbol),
    ladeYahooTrend(symbol),
  ])

  const wsEpsFy0 = wallstreet?.kennzahlen.find((k) => k.schluessel === 'eps')
  const wsUmsatzMio =
    wallstreet?.umsatz.average != null && wallstreet.umsatz.average > 1e6
      ? wallstreet.umsatz.average / 1_000_000
      : wallstreet?.umsatz.average

  const fy0: MergeFy = {
    jahr: pick(stockanalysis?.fy0Jahr, marketscreener?.fy0Jahr, finnhub?.fy0Jahr, wallstreet?.jahr, yahoo?.fy0.jahr),
    umsatzMio: pick(
      stockanalysis?.umsatzUsdFy0 != null ? stockanalysis.umsatzUsdFy0 / 1_000_000 : null,
      marketscreener?.umsatzUsdFy0 != null ? marketscreener.umsatzUsdFy0 / 1_000_000 : null,
      finnhub?.umsatzUsdFy0 != null ? finnhub.umsatzUsdFy0 / 1_000_000 : null,
      wsUmsatzMio ?? null,
      yahoo?.fy0.umsatzMio,
    ),
    eps: pick(
      stockanalysis?.epsFy0,
      finnhub?.epsFy0,
      wsEpsFy0?.spanne.average,
      yahoo?.fy0.eps,
    ),
    umsatzWachstumPct: pick(
      stockanalysis?.umsatzWachstumFy0Pct,
      marketscreener?.umsatzWachstumFy0Pct,
      wachstumPct(
        pick(stockanalysis?.umsatzUsdFy0, marketscreener?.umsatzUsdFy0, finnhub?.umsatzUsdFy0),
        marketscreener?.umsatzBasisUsd ?? null,
      ),
      yahoo?.fy0.umsatzWachstumPct,
    ),
    epsWachstumPct: pick(stockanalysis?.epsWachstumFy0Pct, wsEpsFy0?.wachstumProzent, yahoo?.fy0.epsWachstumPct),
  }

  const fy1: MergeFy = {
    jahr: pick(stockanalysis?.fy1Jahr, marketscreener?.fy1Jahr, finnhub?.fy1Jahr, yahoo?.fy1.jahr),
    umsatzMio: pick(
      stockanalysis?.umsatzUsdFy1 != null ? stockanalysis.umsatzUsdFy1 / 1_000_000 : null,
      marketscreener?.umsatzUsdFy1 != null ? marketscreener.umsatzUsdFy1 / 1_000_000 : null,
      finnhub?.umsatzUsdFy1 != null ? finnhub.umsatzUsdFy1 / 1_000_000 : null,
      yahoo?.fy1.umsatzMio,
    ),
    eps: pick(stockanalysis?.epsFy1, finnhub?.epsFy1, yahoo?.fy1.eps),
    umsatzWachstumPct: pick(
      stockanalysis?.umsatzWachstumFy1Pct,
      marketscreener?.umsatzWachstumFy1Pct,
      wachstumPct(
        pick(stockanalysis?.umsatzUsdFy1, marketscreener?.umsatzUsdFy1, finnhub?.umsatzUsdFy1),
        pick(stockanalysis?.umsatzUsdFy0, marketscreener?.umsatzUsdFy0, finnhub?.umsatzUsdFy0),
      ),
      yahoo?.fy1.umsatzWachstumPct,
    ),
    epsWachstumPct: pick(stockanalysis?.epsWachstumFy1Pct, yahoo?.fy1.epsWachstumPct),
  }

  const quellen: NonNullable<FundamentalSchaetzungenRoh['quelle']>[] = []
  if (stockanalysis) quellen.push('stockanalysis')
  if (marketscreener) quellen.push('marketscreener')
  if (wallstreet) quellen.push('wallstreet')
  if (finnhub) quellen.push('finnhub')
  const yahooNurFallback =
    !stockanalysis &&
    !marketscreener &&
    !wallstreet &&
    !finnhub &&
    (yahoo?.fy0.umsatzMio != null || yahoo?.fy0.eps != null || yahoo?.fy1.umsatzMio != null || yahoo?.fy1.eps != null)
  if (yahooNurFallback) quellen.push('yahoo')
  else if (yahoo && (fy0.umsatzMio == null || fy0.eps == null || fy1.umsatzMio == null || fy1.eps == null)) {
    /* Yahoo füllt Lücken — zählt als kombiniert */
  }

  if (
    fy0.umsatzMio == null &&
    fy0.eps == null &&
    fy1.umsatzMio == null &&
    fy1.eps == null
  ) {
    return { perioden: [], zeilen: [] }
  }

  const quelle: FundamentalSchaetzungenRoh['quelle'] =
    quellen.length === 0
      ? 'yahoo'
      : quellen.length === 1
        ? quellen[0]!
        : yahoo && !yahooNurFallback
          ? 'kombiniert'
          : 'kombiniert'

  const saSchaetz = stockanalysis?.jahresreihe?.filter((e) => e.istSchätzung) ?? []
  if (saSchaetz.length > 0) {
    const roh = baueRohAusStockanalysisReihe(stockanalysis!.jahresreihe)
    if (roh.perioden.length > 0) return roh
  }

  return baueRohAusMerge(fy0, fy1, quelle)
}

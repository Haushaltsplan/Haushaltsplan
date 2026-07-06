import 'server-only'

import { ladeFinnhubJahresForecast } from '@/lib/portfolio-analyse/finnhub-jahres-schaetzungen-server'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import {
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
  fruehestesSchaetzJahr,
  fundamentalSchaetzungIso,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { ladeMarketscreenerJahresForecast } from '@/lib/portfolio-analyse/marketscreener-jahres-consensus-server'
import { marketscreenerUmsatzPlausibel } from '@/lib/portfolio-analyse/marketscreener-forecast-server'
import type { MarketscreenerJahresForecast } from '@/lib/portfolio-analyse/marketscreener-jahres-consensus-server'
import type { FinnhubJahresForecast } from '@/lib/portfolio-analyse/finnhub-jahres-schaetzungen-server'
import {
  ladeStockanalysisJahresForecast,
  type StockanalysisJahresForecast,
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

function leererJahresEintrag(jahr: number): StockanalysisJahresForecastEintrag {
  return {
    jahr,
    periodenEnde: `${jahr}-12-31`,
    umsatzUsd: null,
    operatingIncomeUsd: null,
    netIncomeUsd: null,
    freeCashFlowUsd: null,
    grossProfitUsd: null,
    eps: null,
    adjustedEps: null,
    grossMarginPct: null,
    revenueGrowthPct: null,
    epsGrowthPct: null,
    istSchätzung: true,
  }
}

function hatJahresWert(e: StockanalysisJahresForecastEintrag): boolean {
  return (
    e.umsatzUsd != null ||
    e.operatingIncomeUsd != null ||
    e.netIncomeUsd != null ||
    e.freeCashFlowUsd != null ||
    e.grossProfitUsd != null ||
    e.eps != null
  )
}

function ergaenzeWachstumAusReihe(eintraege: StockanalysisJahresForecastEintrag[]): void {
  for (let i = 1; i < eintraege.length; i++) {
    const prev = eintraege[i - 1]!
    const cur = eintraege[i]!
    if (cur.revenueGrowthPct == null) {
      cur.revenueGrowthPct = wachstumPct(cur.umsatzUsd, prev.umsatzUsd)
    }
    if (cur.epsGrowthPct == null) {
      cur.epsGrowthPct = wachstumPct(cur.eps, prev.eps)
    }
  }
}

function wsKennzahlMio(ws: EarningsSchaetzungen | null, schluessel: string): number | null {
  const v = ws?.kennzahlen.find((k) => k.schluessel === schluessel)?.spanne.average
  return v != null && Number.isFinite(v) ? v : null
}

/** StockAnalysis-Basis + Marketscreener/Finnhub/Wallstreet/Yahoo — nur echte Scrapes, keine Fortschreibung. */
function mergeJahresSchaetzungen(opts: {
  stockanalysis: StockanalysisJahresForecast | null
  marketscreener: MarketscreenerJahresForecast | null
  finnhub: FinnhubJahresForecast | null
  wallstreet: EarningsSchaetzungen | null
  yahoo: { fy0: MergeFy; fy1: MergeFy } | null
}): StockanalysisJahresForecastEintrag[] {
  const byJahr = new Map<number, StockanalysisJahresForecastEintrag>()
  const minJahr = fruehestesSchaetzJahr()

  for (const e of opts.stockanalysis?.jahresreihe?.filter((x) => x.istSchätzung && x.jahr >= minJahr) ?? []) {
    byJahr.set(e.jahr, { ...e })
  }

  const saReferenzUmsatz =
    opts.stockanalysis?.umsatzUsdFy0 ??
    opts.stockanalysis?.jahresreihe?.find((e) => e.umsatzUsd != null && e.umsatzUsd >= 1e9)?.umsatzUsd ??
    null

  for (const ms of opts.marketscreener?.jahresreihe ?? []) {
    if (ms.jahr <= 2000 || ms.jahr < minJahr) continue
    if (ms.umsatzUsd != null && !marketscreenerUmsatzPlausibel(ms.umsatzUsd, saReferenzUmsatz)) continue
    const cur = byJahr.get(ms.jahr) ?? leererJahresEintrag(ms.jahr)
    if (cur.umsatzUsd == null && ms.umsatzUsd != null) cur.umsatzUsd = ms.umsatzUsd
    if (cur.netIncomeUsd == null && ms.netIncomeUsd != null) cur.netIncomeUsd = ms.netIncomeUsd
    byJahr.set(ms.jahr, cur)
  }

  for (const fh of opts.finnhub?.jahresreihe ?? []) {
    if (fh.jahr < minJahr) continue
    const cur = byJahr.get(fh.jahr) ?? leererJahresEintrag(fh.jahr)
    if (cur.umsatzUsd == null && fh.umsatzUsd != null) cur.umsatzUsd = fh.umsatzUsd
    if (cur.eps == null && fh.eps != null) cur.eps = fh.eps
    byJahr.set(fh.jahr, cur)
  }

  const wsJahr = opts.wallstreet?.jahr
  if (wsJahr != null && wsJahr > 2000 && wsJahr >= minJahr) {
    const cur = byJahr.get(wsJahr) ?? leererJahresEintrag(wsJahr)
    if (cur.eps == null) {
      const eps = wsKennzahlMio(opts.wallstreet, 'eps')
      if (eps != null) cur.eps = eps
    }
    if (cur.operatingIncomeUsd == null) {
      const ebitMio = wsKennzahlMio(opts.wallstreet, 'ebit')
      if (ebitMio != null) cur.operatingIncomeUsd = ebitMio * 1_000_000
    }
    if (cur.freeCashFlowUsd == null) {
      const fcfMio = wsKennzahlMio(opts.wallstreet, 'free_cashflow')
      if (fcfMio != null) cur.freeCashFlowUsd = fcfMio * 1_000_000
    }
    if (cur.umsatzUsd == null && opts.wallstreet?.umsatz.average != null) {
      cur.umsatzUsd = opts.wallstreet.umsatz.average
    }
    byJahr.set(wsJahr, cur)
  }

  for (const yf of [opts.yahoo?.fy0, opts.yahoo?.fy1]) {
    if (!yf?.jahr || yf.jahr <= 2000 || yf.jahr < minJahr) continue
    const cur = byJahr.get(yf.jahr) ?? leererJahresEintrag(yf.jahr)
    if (cur.umsatzUsd == null && yf.umsatzMio != null) cur.umsatzUsd = yf.umsatzMio * 1_000_000
    if (cur.eps == null && yf.eps != null) cur.eps = yf.eps
    if (cur.revenueGrowthPct == null && yf.umsatzWachstumPct != null) {
      cur.revenueGrowthPct = yf.umsatzWachstumPct
    }
    if (cur.epsGrowthPct == null && yf.epsWachstumPct != null) cur.epsGrowthPct = yf.epsWachstumPct
    byJahr.set(yf.jahr, cur)
  }

  const reihe = [...byJahr.values()]
    .filter(hatJahresWert)
    .filter((e) => e.jahr >= minJahr)
    .sort((a, b) => a.jahr - b.jahr)
  ergaenzeWachstumAusReihe(reihe)
  return reihe
}

function jahrAusSchaetzungsLabel(label: string): number | null {
  const m = label.match(/FY(\d{2})E/i)
  return m ? 2000 + Number(m[1]) : null
}

function jahrAusSchaetzungIso(iso: string): number | null {
  const m = iso.match(/^__fy(\d{4})e__$/)
  return m ? Number(m[1]) : null
}

/** Kalenderjahre mit mindestens einem Ist-Wert in den Macrotrends-Zeilen. */
export function historischeJahreMitDaten(
  historisch: Pick<{ perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] }, 'perioden' | 'zeilen'>,
): Set<number> {
  const jahre = new Set<number>()
  for (const p of historisch.perioden) {
    if (p.istLtm || p.istSchaetzung || p.istNtm) continue
    const m = p.iso.match(/^(\d{4})-\d{2}-\d{2}$/)
    if (!m) continue
    const jahr = Number(m[1])
    const hatDaten = historisch.zeilen.some((z) => {
      if (z.istSchaetzung || z.gruppe === 'schaetzungen') return false
      const v = z.werte[p.iso]
      return v != null && Number.isFinite(v)
    })
    if (hatDaten) jahre.add(jahr)
  }
  return jahre
}

/**
 * Entfernt Schätzungs-Spalten für Jahre, die bereits als Ist-Daten in Macrotrends vorkommen
 * (z. B. FY25E wenn 2025-12-31 in GuV/CF schon befüllt ist).
 */
export function filterSchaetzungenGegenHistorisch(
  schaetzungen: FundamentalSchaetzungenRoh,
  historisch: Pick<{ perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] }, 'perioden' | 'zeilen'>,
): FundamentalSchaetzungenRoh {
  if (schaetzungen.perioden.length === 0) return schaetzungen

  const minJahr = fruehestesSchaetzJahr()
  const histJahre = historischeJahreMitDaten(historisch)

  const behalten: Array<{ jahr: number; altIso: string }> = []
  for (const p of schaetzungen.perioden) {
    const jahr = jahrAusSchaetzungsLabel(p.label) ?? jahrAusSchaetzungIso(p.iso)
    if (jahr != null && jahr < minJahr) continue
    if (jahr != null && histJahre.has(jahr)) continue
    if (jahr != null) behalten.push({ jahr, altIso: p.iso })
  }

  if (behalten.length === schaetzungen.perioden.length) return schaetzungen
  if (behalten.length === 0) return { perioden: [], zeilen: [], quelle: schaetzungen.quelle }

  const perioden: FundamentalPeriode[] = behalten.map(({ jahr }, i) => ({
    iso: fundamentalSchaetzungIso(jahr, i),
    label: periodEndLabel(jahr, `FY${i}E`),
    istSchaetzung: true,
  }))

  const isoMap = new Map(behalten.map((b, i) => [b.altIso, perioden[i]!.iso]))
  const zeilen = schaetzungen.zeilen.map((z) => {
    const werte: Record<string, number | null> = {}
    for (const [altIso, neuIso] of isoMap) {
      werte[neuIso] = z.werte[altIso] ?? null
    }
    return { ...z, werte }
  })

  return { perioden, zeilen, quelle: schaetzungen.quelle }
}

function baueRohAusJahresreihe(
  eintraege: StockanalysisJahresForecastEintrag[],
  quelle: FundamentalSchaetzungenRoh['quelle'],
): FundamentalSchaetzungenRoh {
  const schaetz = eintraege.filter((e) => e.istSchätzung)
  if (schaetz.length === 0) return { perioden: [], zeilen: [] }
  return { ...baueRohAusStockanalysisReihe(schaetz), quelle }
}

function baueRohAusStockanalysisReihe(
  eintraege: StockanalysisJahresForecastEintrag[],
): FundamentalSchaetzungenRoh {
  const minJahr = fruehestesSchaetzJahr()
  const schaetz = eintraege.filter((e) => e.istSchätzung && e.jahr >= minJahr)
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

  const saSchaetz = mergeJahresSchaetzungen({
    stockanalysis,
    marketscreener,
    finnhub,
    wallstreet,
    yahoo,
  })
  if (saSchaetz.length > 0) {
    const quellenUsed: NonNullable<FundamentalSchaetzungenRoh['quelle']>[] = []
    if (stockanalysis?.jahresreihe?.some((e) => e.istSchätzung)) quellenUsed.push('stockanalysis')
    if (marketscreener?.jahresreihe?.length) quellenUsed.push('marketscreener')
    if (finnhub?.jahresreihe?.length) quellenUsed.push('finnhub')
    if (wallstreet) quellenUsed.push('wallstreet')
    if (
      yahoo &&
      saSchaetz.some(
        (e) =>
          (e.jahr === yahoo.fy0.jahr && (yahoo.fy0.umsatzMio != null || yahoo.fy0.eps != null)) ||
          (e.jahr === yahoo.fy1.jahr && (yahoo.fy1.umsatzMio != null || yahoo.fy1.eps != null)),
      ) &&
      !quellenUsed.includes('yahoo')
    ) {
      quellenUsed.push('yahoo')
    }
    const mergedQuelle: FundamentalSchaetzungenRoh['quelle'] =
      quellenUsed.length === 0
        ? 'kombiniert'
        : quellenUsed.length === 1
          ? quellenUsed[0]!
          : 'kombiniert'
    return baueRohAusJahresreihe(saSchaetz, mergedQuelle)
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

  return baueRohAusMerge(fy0, fy1, quelle)
}

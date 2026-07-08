import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  baueKeyMetrics,
  type YahooFundamentalKennzahlen,
} from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import { baueMantraAudit } from '@/lib/portfolio-analyse/fundamentaldaten-mantra'
import { baueKontextWerte } from '@/lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import { ladeYahooMantraFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'
import { ladeFundamentalNews } from '@/lib/portfolio-analyse/fundamentaldaten-news-server'
import { baueNtmBewertungsZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-ntm-bewertung-server'
import { ladeFundamentalSchaetzungen, filterSchaetzungenGegenHistorisch } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import {
  formatiereBrancheDe,
  ladeUnternehmensbeschreibungDe,
} from '@/lib/portfolio-analyse/fundamentaldaten-unternehmen-de'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeFundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-server'
import { FUNDAMENTAL_NTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
  macrotrendsTickerAusSymbol,
  type MacrotrendsIdent,
  type MacrotrendsIdentOpts,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import {
  baueFundamentalRohAusAlternativQuellen,
  ergaenzeMacrotrendsMitYahooGuV,
  nutzeYahooGuVFuerIsin,
} from '@/lib/portfolio-analyse/fundamentaldaten-yahoo-guv-server'
import { ISIN_WAEHRUNG } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { ladeUnitEconomics } from '@/lib/portfolio-analyse/unit-economics-server'
import { holeYahooFinanceAuth } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function symboleAusAnfrage(anfrage: FundamentaldatenAnfrage): string[] {
  const out = new Set<string>()
  const add = (s?: string | null) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) out.add(t)
  }
  const isin = anfrage.isin?.trim().toUpperCase()
  if (isin) {
    const k = isinKenntnis(isin)
    add(k?.symbolYahoo)
    for (const s of k?.symbolCandidates ?? []) add(s)
  }
  add(anfrage.symbolYahoo)
  for (const s of anfrage.symbolCandidates ?? []) add(s)
  return [...out]
}

function macrotrendsOptsAusAnfrage(
  anfrage: FundamentaldatenAnfrage,
  erwarteterTicker: string,
): MacrotrendsIdentOpts {
  const isin = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: anfrage.symbolYahoo,
    ticker: erwarteterTicker,
    firmenname: anfrage.name,
  })
  const k = isinKenntnis(isin)
  const macrotrendsTicker =
    k?.macrotrendsTicker?.trim().toUpperCase() ||
    k?.symbolYahoo?.split('.')[0]?.toUpperCase() ||
    erwarteterTicker.trim().toUpperCase()
  return {
    erwarteterTicker: macrotrendsTicker,
    firmenname: anfrage.name?.trim() || k?.name?.trim(),
    slug: k?.macrotrendsSlug,
    macrotrendsTicker: k?.macrotrendsTicker,
  }
}

async function loeseIdent(anfrage: FundamentaldatenAnfrage): Promise<{
  ident: MacrotrendsIdent | null
  symbolYahoo: string | null
}> {
  const symbole = symboleAusAnfrage(anfrage)
  const symbolYahoo = symbole[0] ?? anfrage.symbolYahoo ?? null
  const isin = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: anfrage.symbolYahoo ?? symbolYahoo,
    firmenname: anfrage.name,
  })
  const k = isinKenntnis(isin)
  const firmenname = anfrage.name?.trim() || k?.name?.trim()

  if (anfrage.tickerOverride?.trim()) {
    const t = anfrage.tickerOverride.trim().toUpperCase()
    const ident = await loeseMacrotrendsIdent(t, macrotrendsOptsAusAnfrage(anfrage, t))
    return { ident, symbolYahoo }
  }

  for (const sym of symbole) {
    const ticker = macrotrendsTickerAusSymbol(sym)
    const ident = await loeseMacrotrendsIdent(ticker, macrotrendsOptsAusAnfrage(anfrage, ticker))
    if (ident) return { ident, symbolYahoo: sym }
  }

  if (firmenname) {
    const ident = await loeseMacrotrendsIdent(firmenname, { firmenname })
    if (ident) return { ident, symbolYahoo }
  }

  return { ident: null, symbolYahoo }
}

function rawNum(o: Record<string, { raw?: number }> | undefined, k: string): number | undefined {
  const v = o?.[k]?.raw
  return v != null && Number.isFinite(v) ? v : undefined
}

async function ladeYahooFundamentalKennzahlen(symbol: string): Promise<YahooFundamentalKennzahlen | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'defaultKeyStatistics,summaryDetail,assetProfile,financialData,earningsTrend')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: {
      'User-Agent': YAHOO_UA,
      Cookie: auth.cookie,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const j = (await res.json()) as {
    quoteSummary?: {
      result?: Array<{
        defaultKeyStatistics?: Record<string, { raw?: number }>
        summaryDetail?: Record<string, { raw?: number }>
        assetProfile?: Record<string, unknown>
        financialData?: Record<string, { raw?: number }>
        earningsTrend?: { trend?: Array<Record<string, unknown> & { period?: string }> }
      }>
    }
  }
  const row = j.quoteSummary?.result?.[0]
  if (!row) return null
  const dks = row.defaultKeyStatistics
  const sd = row.summaryDetail
  const fd = row.financialData
  const ap = row.assetProfile as Record<string, unknown> | undefined
  const fy0 = row.earningsTrend?.trend?.find((t) => t.period === '0y')
  const fy1 = row.earningsTrend?.trend?.find((t) => t.period === '+1y')
  const epsEst0 = fy0?.earningsEstimate as Record<string, unknown> | undefined
  const revEst0 = fy0?.revenueEstimate as Record<string, unknown> | undefined
  const revEst1 = fy1?.revenueEstimate as Record<string, unknown> | undefined
  const ebitdaEst0 = fy0?.ebitdaEstimate as Record<string, unknown> | undefined
  const ebitdaEst1 = fy1?.ebitdaEstimate as Record<string, unknown> | undefined
  const epsEst1 = fy1?.earningsEstimate as Record<string, unknown> | undefined
  const rawObj = (o: Record<string, unknown> | undefined, k: string) => {
    const v = o?.[k] as { raw?: number } | undefined
    return v?.raw != null && Number.isFinite(v.raw) ? v.raw : undefined
  }

  return {
    fiftyTwoWeekHigh: rawNum(sd, 'fiftyTwoWeekHigh'),
    fiftyTwoWeekLow: rawNum(sd, 'fiftyTwoWeekLow'),
    beta: rawNum(dks, 'beta'),
    marketCap: rawNum(sd, 'marketCap'),
    sharesOutstanding: rawNum(dks, 'sharesOutstanding'),
    floatShares: rawNum(dks, 'floatShares'),
    enterpriseValue: rawNum(dks, 'enterpriseValue'),
    trailingPE: rawNum(sd, 'trailingPE'),
    forwardPE: rawNum(sd, 'forwardPE'),
    dividendYield: rawNum(sd, 'dividendYield'),
    payoutRatio: rawNum(dks, 'payoutRatio') ?? rawNum(sd, 'payoutRatio'),
    trailingEps: rawNum(sd, 'trailingEps') ?? rawNum(dks, 'trailingEps'),
    trailingAnnualDividendRate:
      rawNum(sd, 'trailingAnnualDividendRate') ?? rawNum(dks, 'trailingAnnualDividendRate'),
    returnOnEquity: rawNum(fd, 'returnOnEquity'),
    returnOnAssets: rawNum(fd, 'returnOnAssets'),
    revenueGrowth: rawNum(fd, 'revenueGrowth'),
    earningsGrowth: rawNum(fd, 'earningsGrowth'),
    grossMargins: rawNum(fd, 'grossMargins'),
    operatingMargins: rawNum(fd, 'operatingMargins'),
    ebitdaMargins: rawNum(fd, 'ebitdaMargins'),
    profitMargins: rawNum(fd, 'profitMargins'),
    currentPrice: rawNum(sd, 'regularMarketPrice'),
    targetMeanPrice: rawNum(fd, 'targetMeanPrice'),
    priceToBook: rawNum(dks, 'priceToBook'),
    enterpriseToRevenue: rawNum(dks, 'enterpriseToRevenue'),
    enterpriseToEbitda: rawNum(dks, 'enterpriseToEbitda'),
    totalDebt: rawNum(fd, 'totalDebt'),
    totalCash: rawNum(fd, 'totalCash'),
    averageVolume: rawNum(sd, 'averageDailyVolume3Month') ?? rawNum(sd, 'averageVolume10days'),
    ntmEpsSchaetzung: rawObj(epsEst0, 'avg'),
    ntmRevenueUsd: rawObj(revEst0, 'avg'),
    ntmEbitdaUsd: rawObj(ebitdaEst0, 'avg'),
    fy1RevenueUsd: rawObj(revEst1, 'avg'),
    fy1EbitdaUsd: rawObj(ebitdaEst1, 'avg'),
    fy1Eps: rawObj(epsEst1, 'avg'),
    sector: typeof ap?.sector === 'string' ? ap.sector : undefined,
    industry: typeof ap?.industry === 'string' ? ap.industry : undefined,
    website: typeof ap?.website === 'string' ? ap.website : undefined,
    longBusinessSummary: typeof ap?.longBusinessSummary === 'string' ? ap.longBusinessSummary : undefined,
  } as YahooFundamentalKennzahlen & {
    sector?: string
    industry?: string
    website?: string
    longBusinessSummary?: string
  }
}

function baueMantraMeta(
  yahooExt: (YahooFundamentalKennzahlen & { sector?: string; industry?: string }) | null,
  yahooFinanz: Awaited<ReturnType<typeof ladeYahooMantraFinanzdaten>>,
) {
  return {
    beta: yahooExt?.beta ?? null,
    marketCapUsd: yahooExt?.marketCap ?? null,
    totalDebtUsd: yahooExt?.totalDebt ?? null,
    totalCashUsd: yahooExt?.totalCash ?? null,
    yahooFinanz: yahooFinanz ?? null,
  }
}

function rohFuerMantra(
  roh: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } | null,
): { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } | null {
  if (!roh) return null
  return { perioden: roh.perioden, zeilen: roh.zeilen }
}
const SCHÄTZUNG_ZU_HISTORISCH_ZEILE: Record<string, string> = {
  umsatz_schaetzung: 'umsatz',
  eps_schaetzung: 'eps',
  ebit_schaetzung: 'ebit',
  nettogewinn_schaetzung: 'nettogewinn',
  fcf_schaetzung: 'fcf',
  bruttogewinn_schaetzung: 'bruttogewinn',
}

function mergePeriodenUndZeilen(
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
  schaetzungen: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
): { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } {
  if (schaetzungen.perioden.length === 0) return historisch

  const perioden = [...historisch.perioden, ...schaetzungen.perioden]
  const zeilen = historisch.zeilen.map((z) => ({ ...z, werte: { ...z.werte } }))

  for (const hz of zeilen) {
    for (const sp of schaetzungen.perioden) {
      if (!(sp.iso in hz.werte)) hz.werte[sp.iso] = null
    }
  }

  for (const sz of schaetzungen.zeilen) {
    const histId = SCHÄTZUNG_ZU_HISTORISCH_ZEILE[sz.id]
    if (histId) {
      const hz = zeilen.find((z) => z.id === histId)
      if (hz) {
        for (const sp of schaetzungen.perioden) {
          const v = sz.werte[sp.iso]
          if (v != null && Number.isFinite(v)) hz.werte[sp.iso] = v
        }
      }
    }
  }

  return { perioden, zeilen }
}

function leeresPaket(partial: Partial<FundamentaldatenPaket> & Pick<FundamentaldatenPaket, 'ok' | 'ticker' | 'firmenname'>): FundamentaldatenPaket {
  return {
    slug: '',
    branche: null,
    sektor: null,
    website: null,
    beschreibung: null,
    waehrung: 'USD',
    perioden: [],
    zeilen: [],
    keyMetrics: [],
    mantra: baueMantraAudit(null, null, null, null, { perioden: [], zeilen: [] }),
    mantraMeta: null,
    news: [],
    symbolYahoo: null,
    geladenAm: new Date().toISOString(),
    quelle: 'macrotrends',
    fehler: null,
    erweitert: null,
    ...partial,
  }
}

export async function ladeFundamentaldaten(anfrage: FundamentaldatenAnfrage): Promise<FundamentaldatenPaket> {
  const frequenz = anfrage.frequenz === 'quartal' ? 'quartal' : 'jahr'
  let { ident, symbolYahoo } = await loeseIdent(anfrage)

  const isinNormEarly = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: symbolYahoo ?? anfrage.symbolYahoo,
    firmenname: anfrage.name,
  })
  const kEarly = isinNormEarly ? isinKenntnis(isinNormEarly) : null

  if (!ident && isinNormEarly && nutzeYahooGuVFuerIsin(isinNormEarly)) {
    const sym = symbolYahoo ?? kEarly?.symbolYahoo ?? anfrage.symbolYahoo
    if (sym) {
      const mt =
        kEarly?.macrotrendsTicker?.trim().toUpperCase() ||
        macrotrendsTickerAusSymbol(sym)
      ident = {
        ticker: mt,
        slug: kEarly?.macrotrendsSlug ?? mt.toLowerCase(),
        firmenname: kEarly?.name ?? anfrage.name ?? mt,
      }
      symbolYahoo = sym
    }
  }

  if (!ident) {
    return leeresPaket({
      ok: false,
      ticker: anfrage.tickerOverride?.trim().toUpperCase() ?? '',
      firmenname: anfrage.name ?? 'Unbekannt',
      symbolYahoo,
      fehler: 'Keine Fundamentaldaten auf Macrotrends gefunden. Ticker manuell eingeben.',
    })
  }

  const [rohRaw, yahooRaw, schaetzungen, news, yahooFinanz, unitEconomics, erweitert] = await Promise.all([
    ladeMacrotrendsFundamentaldaten(ident, frequenz),
    symbolYahoo ? ladeYahooFundamentalKennzahlen(symbolYahoo) : Promise.resolve(null),
    frequenz === 'jahr' && symbolYahoo
      ? ladeFundamentalSchaetzungen({
          symbol: symbolYahoo,
          isin: anfrage.isin,
          name: anfrage.name ?? ident.firmenname,
          ticker: ident.ticker,
        })
      : Promise.resolve({ perioden: [], zeilen: [] }),
    symbolYahoo ? ladeFundamentalNews(symbolYahoo, ident.firmenname) : Promise.resolve([]),
    symbolYahoo ? ladeYahooMantraFinanzdaten(symbolYahoo) : Promise.resolve(null),
    ladeUnitEconomics(ident.ticker).catch(() => null),
    ladeFundamentaldatenErweitert({
      ticker: ident.ticker,
      symbolYahoo,
      isin: isinNormEarly ?? anfrage.isin?.trim().toUpperCase() ?? null,
      firmenname: anfrage.name ?? ident.firmenname,
    }),
  ])

  let roh = rohRaw
  const isinNorm = loesePortfolioIsin({
    isin: anfrage.isin,
    symbolYahoo: symbolYahoo ?? anfrage.symbolYahoo,
    firmenname: anfrage.name ?? ident.firmenname,
  })
  if (
    (!roh || roh.zeilen.length === 0) &&
    symbolYahoo &&
    frequenz === 'jahr' &&
    nutzeYahooGuVFuerIsin(isinNorm ?? anfrage.isin)
  ) {
    const fallback = await baueFundamentalRohAusAlternativQuellen(ident, symbolYahoo, {
      isin: isinNorm ?? anfrage.isin,
      firmenname: anfrage.name ?? ident.firmenname,
      ticker: ident.ticker,
    })
    if (fallback) roh = fallback
  } else if (roh && symbolYahoo && frequenz === 'jahr' && nutzeYahooGuVFuerIsin(isinNorm ?? anfrage.isin)) {
    roh = await ergaenzeMacrotrendsMitYahooGuV(roh, symbolYahoo, {
      isin: isinNorm ?? anfrage.isin,
      firmenname: anfrage.name ?? ident.firmenname,
      ticker: ident.ticker,
    })
  }

  const yahooExt = yahooRaw as (YahooFundamentalKennzahlen & {
    sector?: string
    industry?: string
    website?: string
    longBusinessSummary?: string
  }) | null

  const brancheMeta = formatiereBrancheDe({ industry: yahooExt?.industry, sector: yahooExt?.sector })
  const beschreibungDe = await ladeUnternehmensbeschreibungDe({
    firmenname: ident.firmenname,
    ticker: ident.ticker,
    fallbackEn: yahooExt?.longBusinessSummary ?? roh?.beschreibung,
  })

  const mantraMeta = baueMantraMeta(yahooExt, yahooFinanz)

  if (!roh) {
    return leeresPaket({
      ok: false,
      ticker: ident.ticker,
      slug: ident.slug,
      firmenname: ident.firmenname,
      branche: brancheMeta.branche,
      sektor: brancheMeta.sektor,
      website: yahooExt?.website ?? null,
      beschreibung: beschreibungDe,
      keyMetrics: baueKeyMetrics(yahooExt, null, schaetzungen, null),
      mantra: baueMantraAudit(brancheMeta.sektor, brancheMeta.branche, yahooExt, null, schaetzungen, yahooFinanz),
      mantraMeta,
      news,
      symbolYahoo,
      erweitert,
      fehler: 'Macrotrends-Daten konnten nicht geladen werden.',
    })
  }

  const schaetzungenGefiltert = roh
    ? filterSchaetzungenGegenHistorisch(schaetzungen, roh)
    : schaetzungen

  const merged =
    frequenz === 'jahr'
      ? mergePeriodenUndZeilen(roh, schaetzungenGefiltert)
      : { perioden: roh.perioden, zeilen: roh.zeilen }

  const ntm =
    frequenz === 'jahr'
      ? await baueNtmBewertungsZeilen(symbolYahoo, merged.perioden, merged.zeilen, yahooExt)
      : { zeilen: [] as FundamentalMetrikZeile[], periodenPatch: undefined }
  if (ntm.zeilen.length > 0) {
    if (ntm.periodenPatch && !merged.perioden.some((p) => p.iso === FUNDAMENTAL_NTM_KEY)) {
      const schaetzIdx = merged.perioden.findIndex((p) => p.istSchaetzung)
      if (schaetzIdx >= 0) merged.perioden.splice(schaetzIdx, 0, ntm.periodenPatch)
      else merged.perioden.push(ntm.periodenPatch)
    }
    for (const z of merged.zeilen) {
      if (!(FUNDAMENTAL_NTM_KEY in z.werte)) z.werte[FUNDAMENTAL_NTM_KEY] = null
    }
    merged.zeilen.push(...ntm.zeilen)
  }
  const sektorFinal = brancheMeta.sektor
  const brancheFinal = brancheMeta.branche ?? roh.branche
  const mergedRoh = { ...roh, perioden: merged.perioden, zeilen: merged.zeilen }
  const kontextWerte = baueKontextWerte({
    yahoo: yahooExt,
    roh: rohFuerMantra(merged),
    schaetzungen: schaetzungenGefiltert,
    yahooFinanz,
    unitEconomics,
  })
  const waehrung = (isinNorm && ISIN_WAEHRUNG[isinNorm]) || 'USD'

  return leeresPaket({
    ok: true,
    ticker: ident.ticker,
    slug: ident.slug,
    firmenname: ident.firmenname,
    branche: brancheFinal,
    sektor: sektorFinal,
    website: yahooExt?.website ?? null,
    beschreibung: beschreibungDe,
    waehrung,
    perioden: merged.perioden,
    zeilen: merged.zeilen,
    keyMetrics: baueKeyMetrics(yahooExt, mergedRoh, schaetzungenGefiltert, kontextWerte),
    mantra: baueMantraAudit(
      sektorFinal,
      brancheFinal,
      yahooExt,
      rohFuerMantra(merged),
      schaetzungenGefiltert,
      yahooFinanz,
      kontextWerte,
    ),
    mantraMeta,
    news,
    symbolYahoo,
    frequenz,
    erweitert,
  })
}

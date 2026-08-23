/** Capital-Allocation-Score — Buybacks, Dividenden, CapEx, M&A vs. OCF. */

import 'server-only'

import { ladeSecCapitalAllocation } from '@/lib/portfolio-analyse/sec-edgar-companyfacts-server'
import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { yahooKennzahlenSymbolKandidaten } from '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: CapitalAllocationPaket }>()

export type CapitalAllocationBewertung = 'gut' | 'neutral' | 'warnung' | 'keine_daten'

export type CapitalAllocationSaeule = {
  id: 'capex' | 'dividend' | 'buyback' | 'mna'
  label: string
  betragMioUsd: number | null
  pctVonOcf: number | null
  bewertung: CapitalAllocationBewertung
  hinweis: string
}

export type CapitalAllocationPaket = {
  ok: boolean
  ticker: string
  periodeLabel: string | null
  ocfMioUsd: number | null
  fcfMioUsd: number | null
  umsatzMioUsd: number | null
  saeulen: CapitalAllocationSaeule[]
  scorePct: number | null
  scoreLabel: 'stark' | 'solide' | 'beobachten' | 'schwach' | 'keine_daten'
  scoreHinweis: string
  geladenAm: string
  fehler?: string | null
}

type CfRow = Record<string, { raw?: number } | undefined>

function rawNum(row: CfRow | undefined, key: string): number | null {
  const v = row?.[key]?.raw
  return v != null && Number.isFinite(v) ? v : null
}

function mioUsd(v: number | null): number | null {
  if (v == null) return null
  return Math.round((v / 1_000_000) * 10) / 10
}

function pct(teil: number | null, basis: number | null): number | null {
  if (teil == null || basis == null || basis === 0) return null
  return Math.round((Math.abs(teil) / Math.abs(basis)) * 1000) / 10
}

function bewerteSaeule(
  id: CapitalAllocationSaeule['id'],
  pctVonOcf: number | null,
  fcfMio: number | null,
): { bewertung: CapitalAllocationBewertung; hinweis: string } {
  if (pctVonOcf == null) return { bewertung: 'keine_daten', hinweis: 'Keine Daten' }
  switch (id) {
    case 'capex':
      if (pctVonOcf >= 5 && pctVonOcf <= 30) return { bewertung: 'gut', hinweis: 'Investition in Wachstum/Erhalt im üblichen Rahmen' }
      if (pctVonOcf > 45) return { bewertung: 'warnung', hinweis: 'Hohe CapEx-Last — Rendite der Projekte prüfen' }
      return { bewertung: 'neutral', hinweis: 'CapEx außerhalb typischer Bandbreite' }
    case 'dividend':
      if (pctVonOcf <= 40) return { bewertung: 'gut', hinweis: 'Dividende aus Cashflow gut gedeckt' }
      if (pctVonOcf > 60 || (fcfMio != null && fcfMio < 0)) {
        return { bewertung: 'warnung', hinweis: 'Dividende möglicherweise nicht aus FCF finanzierbar' }
      }
      return { bewertung: 'neutral', hinweis: 'Moderate Ausschüttungsquote' }
    case 'buyback':
      if (pctVonOcf === 0) return { bewertung: 'neutral', hinweis: 'Keine nennenswerten Buybacks' }
      if (fcfMio != null && fcfMio > 0 && pctVonOcf <= 50) {
        return { bewertung: 'gut', hinweis: 'Rückkäufe aus freiem Cashflow' }
      }
      if (fcfMio != null && fcfMio < 0 && pctVonOcf > 20) {
        return { bewertung: 'warnung', hinweis: 'Buybacks trotz negativem FCF — Leverage prüfen' }
      }
      return { bewertung: 'neutral', hinweis: 'Buybacks im mittleren Bereich' }
    case 'mna':
      if (pctVonOcf <= 10) return { bewertung: 'gut', hinweis: 'Geringe M&A-Cash-Nutzung' }
      if (pctVonOcf > 35) return { bewertung: 'warnung', hinweis: 'Hohe Akquisitions-Aktivität — Integrations-ROIC prüfen' }
      return { bewertung: 'neutral', hinweis: 'Moderate M&A-Aktivität' }
    default:
      return { bewertung: 'neutral', hinweis: '' }
  }
}

function scoreAusSaeulen(
  saeulen: CapitalAllocationSaeule[],
  fcfMio: number | null,
  ocfMio: number | null,
): { scorePct: number; label: CapitalAllocationPaket['scoreLabel']; hinweis: string } {
  if (ocfMio == null) return { scorePct: 0, label: 'keine_daten', hinweis: 'Kein operativer Cashflow verfügbar.' }

  let score = 50
  if (fcfMio != null && fcfMio > 0) score += 15
  if (fcfMio != null && fcfMio < 0) score -= 15

  for (const s of saeulen) {
    if (s.bewertung === 'gut') score += 8
    if (s.bewertung === 'warnung') score -= 10
  }

  const divBuy = (saeulen.find((s) => s.id === 'dividend')?.pctVonOcf ?? 0) + (saeulen.find((s) => s.id === 'buyback')?.pctVonOcf ?? 0)
  if (fcfMio != null && fcfMio > 0 && divBuy > 0 && divBuy <= 80) score += 5

  score = Math.max(0, Math.min(100, score))
  const label: CapitalAllocationPaket['scoreLabel'] =
    score >= 75 ? 'stark' : score >= 55 ? 'solide' : score >= 35 ? 'beobachten' : 'schwach'

  const hinweis =
    label === 'stark'
      ? 'Kapital fließt überwiegend in nachhaltige Reinvestition und verantwortbare Ausschüttungen.'
      : label === 'solide'
        ? 'Capital Allocation im normalen Rahmen — Details je Säule prüfen.'
        : label === 'beobachten'
          ? 'Mindestens ein Warnsignal — Buybacks/Dividenden vs. FCF prüfen.'
          : 'Schwache Kapitalallokation oder negative FCF-Dynamik.'

  return { scorePct: score, label, hinweis }
}

async function ladeCashflowLtmYahoo(symbol: string): Promise<{
  periodeLabel: string | null
  ocfUsd: number | null
  capexUsd: number | null
  dividendUsd: number | null
  buybackUsd: number | null
  mnaUsd: number | null
  revenueUsd: number | null
}> {
  const leer = {
    periodeLabel: null,
    ocfUsd: null,
    capexUsd: null,
    dividendUsd: null,
    buybackUsd: null,
    mnaUsd: null,
    revenueUsd: null,
  }
  const auth = await holeYahooFinanceAuth()
  if (!auth) return leer

  // Korrekte Yahoo-v10-Module (nicht „cashflowStatement“ — liefert für EU oft leer).
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set(
    'modules',
    'cashflowStatementHistory,cashflowStatementHistoryQuarterly,financialData,incomeStatementHistory',
  )
  u.searchParams.set('crumb', auth.crumb)

  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return leer

  const result = (await res.json()).quoteSummary?.result?.[0] ?? {}
  const quarterly = (result.cashflowStatementHistoryQuarterly?.cashflowStatements ?? []) as Array<
    CfRow & { endDate?: { raw?: number; fmt?: string } }
  >

  if (quarterly.length >= 4) {
    const q = quarterly.slice(0, 4)
    const sum = (key: string) =>
      q.reduce((acc, row) => {
        const v = rawNum(row, key)
        return acc + (v ?? 0)
      }, 0)

    const ocf = sum('totalCashFromOperatingActivities')
    const capex = sum('capitalExpenditures') || sum('capitalExpenditure')
    const div = sum('dividendsPaid')
    const buyback = sum('repurchaseOfCapitalStock') || sum('commonStockRepurchased')
    const mna = sum('purchaseOfBusiness') || sum('paymentsToAcquireBusinesses')

    const endFmt = q[0]?.endDate?.fmt ?? null
    return {
      periodeLabel: endFmt ? `LTM bis ${endFmt}` : 'LTM (4 Quartale)',
      ocfUsd: ocf !== 0 ? ocf : null,
      capexUsd: capex !== 0 ? capex : null,
      dividendUsd: div !== 0 ? div : null,
      buybackUsd: buyback !== 0 ? buyback : null,
      mnaUsd: mna !== 0 ? mna : null,
      revenueUsd: result.financialData?.totalRevenue?.raw ?? null,
    }
  }

  const annual = (result.cashflowStatementHistory?.cashflowStatements?.[0] ?? null) as
    | (CfRow & { endDate?: { fmt?: string } })
    | null

  if (!annual) return leer

  return {
    periodeLabel: annual.endDate?.fmt ? `GJ ${annual.endDate.fmt}` : 'Letztes GJ',
    ocfUsd: rawNum(annual, 'totalCashFromOperatingActivities'),
    capexUsd: rawNum(annual, 'capitalExpenditures') ?? rawNum(annual, 'capitalExpenditure'),
    dividendUsd: rawNum(annual, 'dividendsPaid'),
    buybackUsd:
      rawNum(annual, 'repurchaseOfCapitalStock') ?? rawNum(annual, 'commonStockRepurchased'),
    mnaUsd: rawNum(annual, 'purchaseOfBusiness') ?? rawNum(annual, 'paymentsToAcquireBusinesses'),
    revenueUsd: result.financialData?.totalRevenue?.raw ?? null,
  }
}

async function ladeCashflowViaTimeseries(symbol: string): Promise<{
  periodeLabel: string | null
  ocfUsd: number | null
  capexUsd: number | null
  dividendUsd: number | null
  buybackUsd: number | null
  mnaUsd: number | null
  revenueUsd: number | null
}> {
  const leer = {
    periodeLabel: null,
    ocfUsd: null,
    capexUsd: null,
    dividendUsd: null,
    buybackUsd: null,
    mnaUsd: null,
    revenueUsd: null,
  }
  try {
    const { ladeYahooMantraFinanzdaten } = await import(
      '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'
    )
    const daten = await ladeYahooMantraFinanzdaten(symbol)
    if (!daten) return leer

    const last = daten.annualHistorie[daten.annualHistorie.length - 1]
    const ocf = daten.operatingCashFlowUsd ?? last?.operatingCashFlowUsd ?? null
    const capex = last?.capitalExpenditureUsd ?? null
    const mna = last?.purchaseOfBusinessUsd ?? null
    const revenue = daten.revenueUsd ?? null

    if (ocf == null) return leer
    return {
      periodeLabel: last?.datum ? `GJ ${last.datum}` : 'Trailing / letztes GJ',
      ocfUsd: ocf,
      capexUsd: capex,
      dividendUsd: null,
      buybackUsd: null,
      mnaUsd: mna,
      revenueUsd: revenue,
    }
  } catch {
    return leer
  }
}

export async function ladeCapitalAllocation(opts: {
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
  force?: boolean
}): Promise<CapitalAllocationPaket> {
  const ticker = opts.ticker.trim().toUpperCase()
  const sym = (opts.symbolYahoo ?? ticker).trim().toUpperCase()
  const key = `${ticker}:${sym}`
  const hit = cache.get(key)
  if (hit && hit.at + CACHE_MS > Date.now() && !opts.force) return hit.data

  try {
    const cik = await cikFuerTicker(ticker)
    let cf: {
      periodeLabel: string | null
      ocfUsd: number | null
      capexUsd: number | null
      dividendUsd: number | null
      buybackUsd: number | null
      mnaUsd: number | null
      revenueUsd: number | null
    } | null = null

    if (cik) {
      const sec = await ladeSecCapitalAllocation(cik)
      if (sec?.ocfUsd != null) {
        cf = {
          periodeLabel: sec.periodeLabel,
          ocfUsd: sec.ocfUsd,
          capexUsd: sec.capexUsd,
          dividendUsd: sec.dividendUsd,
          buybackUsd: sec.buybackUsd,
          mnaUsd: sec.mnaUsd,
          revenueUsd: sec.revenueUsd,
        }
      }
    }

    if (!cf?.ocfUsd) {
      const symbole = yahooKennzahlenSymbolKandidaten({
        symbolYahoo: sym,
        isin: opts.isin,
        macrotrendsTicker: opts.isin ? isinKenntnis(opts.isin)?.macrotrendsTicker : null,
      })
      for (const s of symbole) {
        const yahoo = await ladeCashflowLtmYahoo(s)
        if (yahoo.ocfUsd != null) {
          cf = yahoo
          break
        }
      }
    }

    if (!cf?.ocfUsd) {
      const symbole = yahooKennzahlenSymbolKandidaten({
        symbolYahoo: sym,
        isin: opts.isin,
        macrotrendsTicker: opts.isin ? isinKenntnis(opts.isin)?.macrotrendsTicker : null,
      })
      for (const s of symbole) {
        const ts = await ladeCashflowViaTimeseries(s)
        if (ts.ocfUsd != null) {
          cf = ts
          break
        }
      }
    }

    if (!cf) {
      cf = {
        periodeLabel: null,
        ocfUsd: null,
        capexUsd: null,
        dividendUsd: null,
        buybackUsd: null,
        mnaUsd: null,
        revenueUsd: null,
      }
    }
    const ocfMio = mioUsd(cf.ocfUsd)
    const capexMio = mioUsd(cf.capexUsd != null ? Math.abs(cf.capexUsd) : null)
    const divMio = mioUsd(cf.dividendUsd != null ? Math.abs(cf.dividendUsd) : null) ?? (ocfMio != null ? 0 : null)
    const buyMio = mioUsd(cf.buybackUsd != null ? Math.abs(cf.buybackUsd) : null) ?? (ocfMio != null ? 0 : null)
    const mnaMio = mioUsd(cf.mnaUsd != null ? Math.abs(cf.mnaUsd) : null) ?? (ocfMio != null ? 0 : null)
    const umsatzMio = mioUsd(cf.revenueUsd)
    const fcfMio =
      ocfMio != null && capexMio != null ? Math.round((ocfMio - capexMio) * 10) / 10 : null

    const saeulen: CapitalAllocationSaeule[] = [
      {
        id: 'capex',
        label: 'CapEx (Investitionen)',
        betragMioUsd: capexMio,
        pctVonOcf: pct(cf.capexUsd != null ? Math.abs(cf.capexUsd) : null, cf.ocfUsd),
        ...bewerteSaeule('capex', pct(cf.capexUsd != null ? Math.abs(cf.capexUsd) : null, cf.ocfUsd), fcfMio),
      },
      {
        id: 'dividend',
        label: 'Dividenden',
        betragMioUsd: divMio,
        pctVonOcf: pct(Math.abs(cf.dividendUsd ?? 0), cf.ocfUsd),
        ...bewerteSaeule(
          'dividend',
          pct(Math.abs(cf.dividendUsd ?? 0), cf.ocfUsd),
          fcfMio,
        ),
      },
      {
        id: 'buyback',
        label: 'Buybacks / Rückkäufe',
        betragMioUsd: buyMio,
        pctVonOcf: pct(Math.abs(cf.buybackUsd ?? 0), cf.ocfUsd),
        ...bewerteSaeule(
          'buyback',
          pct(Math.abs(cf.buybackUsd ?? 0), cf.ocfUsd),
          fcfMio,
        ),
      },
      {
        id: 'mna',
        label: 'M&A (Akquisitionen)',
        betragMioUsd: mnaMio,
        pctVonOcf: pct(Math.abs(cf.mnaUsd ?? 0), cf.ocfUsd),
        ...bewerteSaeule('mna', pct(Math.abs(cf.mnaUsd ?? 0), cf.ocfUsd), fcfMio),
      },
    ]

    const { scorePct, label, hinweis } = scoreAusSaeulen(saeulen, fcfMio, ocfMio)

    const paket: CapitalAllocationPaket = {
      ok: ocfMio != null,
      ticker,
      periodeLabel: cf.periodeLabel,
      ocfMioUsd: ocfMio,
      fcfMioUsd: fcfMio,
      umsatzMioUsd: umsatzMio,
      saeulen,
      scorePct: ocfMio != null ? scorePct : null,
      scoreLabel: ocfMio != null ? label : 'keine_daten',
      scoreHinweis: hinweis,
      geladenAm: new Date().toISOString(),
    }
    cache.set(key, { at: Date.now(), data: paket })
    return paket
  } catch (e) {
    return {
      ok: false,
      ticker,
      periodeLabel: null,
      ocfMioUsd: null,
      fcfMioUsd: null,
      umsatzMioUsd: null,
      saeulen: [],
      scorePct: null,
      scoreLabel: 'keine_daten',
      scoreHinweis: '',
      geladenAm: new Date().toISOString(),
      fehler: e instanceof Error ? e.message : 'Capital Allocation fehlgeschlagen',
    }
  }
}

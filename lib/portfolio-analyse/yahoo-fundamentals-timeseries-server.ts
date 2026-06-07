import 'server-only'

import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; daten: MantraYahooTrailing | null }>()

const TRAILING_TYPES = [
  'trailingStockBasedCompensation',
  'trailingInterestExpense',
  'trailingResearchAndDevelopment',
  'trailingSellingGeneralAndAdministration',
  'trailingFreeCashFlow',
  'trailingOperatingIncome',
  'trailingTotalRevenue',
  'trailingNetIncome',
] as const

export type MantraYahooTrailing = {
  stockBasedCompensationUsd: number | null
  interestExpenseUsd: number | null
  researchDevelopmentUsd: number | null
  sgaUsd: number | null
  freeCashFlowUsd: number | null
  operatingIncomeUsd: number | null
  revenueUsd: number | null
  netIncomeUsd: number | null
}

type TimeseriesBlock = {
  meta?: { type?: string[] }
  [key: string]: unknown
}

function letzterWert(block: TimeseriesBlock | undefined): number | null {
  if (!block) return null
  const typ = block.meta?.type?.[0]
  if (!typ) return null
  const arr = block[typ]
  if (!Array.isArray(arr) || arr.length === 0) return null
  const latest = arr[arr.length - 1] as { reportedValue?: { raw?: number } } | undefined
  const raw = latest?.reportedValue?.raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function blockFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesBlock | undefined {
  return result.find((b) => b.meta?.type?.[0] === typ)
}

export async function ladeYahooMantraTrailing(symbol: string): Promise<MantraYahooTrailing | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const cached = cache.get(sym)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.daten

  const auth = await holeYahooFinanceAuth()
  if (!auth) {
    cache.set(sym, { at: Date.now(), daten: null })
    return null
  }

  const period1 = Math.floor(new Date('2018-01-01').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const u = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}`,
  )
  u.searchParams.set('symbol', sym)
  u.searchParams.set('type', TRAILING_TYPES.join(','))
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), daten: null })
      return null
    }

    const j = (await res.json()) as { timeseries?: { result?: TimeseriesBlock[] } }
    const result = j.timeseries?.result ?? []

    const daten: MantraYahooTrailing = {
      stockBasedCompensationUsd: letzterWert(blockFuerTyp(result, 'trailingStockBasedCompensation')),
      interestExpenseUsd: letzterWert(blockFuerTyp(result, 'trailingInterestExpense')),
      researchDevelopmentUsd: letzterWert(blockFuerTyp(result, 'trailingResearchAndDevelopment')),
      sgaUsd: letzterWert(blockFuerTyp(result, 'trailingSellingGeneralAndAdministration')),
      freeCashFlowUsd: letzterWert(blockFuerTyp(result, 'trailingFreeCashFlow')),
      operatingIncomeUsd: letzterWert(blockFuerTyp(result, 'trailingOperatingIncome')),
      revenueUsd: letzterWert(blockFuerTyp(result, 'trailingTotalRevenue')),
      netIncomeUsd: letzterWert(blockFuerTyp(result, 'trailingNetIncome')),
    }

    cache.set(sym, { at: Date.now(), daten })
    return daten
  } catch {
    cache.set(sym, { at: Date.now(), daten: null })
    return null
  }
}

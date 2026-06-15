import 'server-only'

import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'
import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; daten: MantraYahooFinanzdaten | null }>()

const TRAILING_TYPES = [
  'trailingStockBasedCompensation',
  'trailingInterestExpense',
  'trailingResearchAndDevelopment',
  'trailingSellingGeneralAndAdministration',
  'trailingFreeCashFlow',
  'trailingOperatingIncome',
  'trailingTotalRevenue',
  'trailingNetIncome',
  'trailingPretaxIncome',
  'trailingTaxProvision',
  'trailingOperatingCashFlow',
] as const

const ANNUAL_TYPES = [
  'annualOperatingIncome',
  'annualPretaxIncome',
  'annualTaxProvision',
  'annualTotalDebt',
  'annualStockholdersEquity',
  'annualNetIncome',
  'annualCapitalExpenditure',
  'annualChangeInWorkingCapital',
  'annualPurchaseOfBusiness',
  'annualOperatingCashFlow',
  'annualGoodwill',
  'annualDepreciationAmortizationInIncomeStatement',
  'annualCashAndCashEquivalents',
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
  pretaxIncomeUsd: number | null
  taxProvisionUsd: number | null
  operatingCashFlowUsd: number | null
}

export type MantraYahooFinanzdaten = MantraYahooTrailing & {
  /** Chronologisch sortierte Geschäftsjahre (ältestes zuerst). */
  annualHistorie: YahooJahresSnapshot[]
}

type TimeseriesBlock = {
  meta?: { type?: string[] }
  [key: string]: unknown
}

type TimeseriesPunkt = {
  asOfDate?: string
  reportedValue?: { raw?: number }
}

const ANNUAL_FELDER: Record<keyof Omit<YahooJahresSnapshot, 'datum'>, string> = {
  operatingIncomeUsd: 'annualOperatingIncome',
  pretaxIncomeUsd: 'annualPretaxIncome',
  taxProvisionUsd: 'annualTaxProvision',
  totalDebtUsd: 'annualTotalDebt',
  stockholdersEquityUsd: 'annualStockholdersEquity',
  netIncomeUsd: 'annualNetIncome',
  capitalExpenditureUsd: 'annualCapitalExpenditure',
  changeInWorkingCapitalUsd: 'annualChangeInWorkingCapital',
  purchaseOfBusinessUsd: 'annualPurchaseOfBusiness',
  operatingCashFlowUsd: 'annualOperatingCashFlow',
  depreciationAmortizationUsd: 'annualDepreciationAmortizationInIncomeStatement',
  goodwillUsd: 'annualGoodwill',
  cashAndEquivalentsUsd: 'annualCashAndCashEquivalents',
}

function letzterWert(block: TimeseriesBlock | undefined): number | null {
  if (!block) return null
  const typ = block.meta?.type?.[0]
  if (!typ) return null
  const arr = block[typ]
  if (!Array.isArray(arr) || arr.length === 0) return null
  const latest = arr[arr.length - 1] as TimeseriesPunkt | undefined
  const raw = latest?.reportedValue?.raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function blockFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesBlock | undefined {
  return result.find((b) => b.meta?.type?.[0] === typ)
}

function baueAnnualHistorie(result: TimeseriesBlock[]): YahooJahresSnapshot[] {
  const datenProTyp = new Map<string, TimeseriesPunkt[]>()
  for (const [feld, typ] of Object.entries(ANNUAL_FELDER)) {
    const block = blockFuerTyp(result, typ)
    const t = block?.meta?.type?.[0]
    const arr = t && Array.isArray(block?.[t]) ? (block[t] as TimeseriesPunkt[]) : []
    datenProTyp.set(feld, arr)
  }

  const referenz = datenProTyp.get('operatingIncomeUsd') ?? []
  const out: YahooJahresSnapshot[] = []

  for (let i = 0; i < referenz.length; i++) {
    const datum = referenz[i]?.asOfDate
    if (!datum) continue
    const snap: YahooJahresSnapshot = {
      datum,
      operatingIncomeUsd: null,
      pretaxIncomeUsd: null,
      taxProvisionUsd: null,
      totalDebtUsd: null,
      stockholdersEquityUsd: null,
      netIncomeUsd: null,
      capitalExpenditureUsd: null,
      changeInWorkingCapitalUsd: null,
      purchaseOfBusinessUsd: null,
      operatingCashFlowUsd: null,
      depreciationAmortizationUsd: null,
      goodwillUsd: null,
      cashAndEquivalentsUsd: null,
    }
    for (const [feld, typArr] of datenProTyp.entries()) {
      const raw = typArr[i]?.reportedValue?.raw
      ;(snap as Record<string, unknown>)[feld] = raw != null && Number.isFinite(raw) ? raw : null
    }
    out.push(snap)
  }

  return out.sort((a, b) => a.datum.localeCompare(b.datum))
}

async function ladeTimeseriesResult(symbol: string, types: readonly string[]): Promise<TimeseriesBlock[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const period1 = Math.floor(new Date('2015-01-01').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const u = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
  )
  u.searchParams.set('symbol', symbol)
  u.searchParams.set('type', types.join(','))
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))
  u.searchParams.set('crumb', auth.crumb)

  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []

  const j = (await res.json()) as { timeseries?: { result?: TimeseriesBlock[] } }
  return j.timeseries?.result ?? []
}

export async function ladeYahooMantraFinanzdaten(symbol: string): Promise<MantraYahooFinanzdaten | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const cached = cache.get(sym)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.daten

  try {
    const result = await ladeTimeseriesResult(sym, [...TRAILING_TYPES, ...ANNUAL_TYPES])
    if (result.length === 0) {
      cache.set(sym, { at: Date.now(), daten: null })
      return null
    }

    const daten: MantraYahooFinanzdaten = {
      stockBasedCompensationUsd: letzterWert(blockFuerTyp(result, 'trailingStockBasedCompensation')),
      interestExpenseUsd: letzterWert(blockFuerTyp(result, 'trailingInterestExpense')),
      researchDevelopmentUsd: letzterWert(blockFuerTyp(result, 'trailingResearchAndDevelopment')),
      sgaUsd: letzterWert(blockFuerTyp(result, 'trailingSellingGeneralAndAdministration')),
      freeCashFlowUsd: letzterWert(blockFuerTyp(result, 'trailingFreeCashFlow')),
      operatingIncomeUsd: letzterWert(blockFuerTyp(result, 'trailingOperatingIncome')),
      revenueUsd: letzterWert(blockFuerTyp(result, 'trailingTotalRevenue')),
      netIncomeUsd: letzterWert(blockFuerTyp(result, 'trailingNetIncome')),
      pretaxIncomeUsd: letzterWert(blockFuerTyp(result, 'trailingPretaxIncome')),
      taxProvisionUsd: letzterWert(blockFuerTyp(result, 'trailingTaxProvision')),
      operatingCashFlowUsd: letzterWert(blockFuerTyp(result, 'trailingOperatingCashFlow')),
      annualHistorie: baueAnnualHistorie(result),
    }

    cache.set(sym, { at: Date.now(), daten })
    return daten
  } catch {
    cache.set(sym, { at: Date.now(), daten: null })
    return null
  }
}

import 'server-only'

import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; daten: YahooBilanzSnapshot[] }>()

export type YahooBilanzSnapshot = {
  datum: string
  stockholdersEquityUsd: number | null
  totalDebtUsd: number | null
  deferredTaxLiabilitiesNonCurrentUsd: number | null
  deferredTaxLiabilitiesCurrentUsd: number | null
}

function rawNum(o: Record<string, { raw?: number }> | undefined, k: string): number | null {
  const v = o?.[k]?.raw
  return v != null && Number.isFinite(v) ? v : null
}

function isoAusEndDate(raw: number | undefined): string | null {
  if (raw == null || !Number.isFinite(raw)) return null
  const d = new Date(raw * 1000)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseBalanceRows(rows: Array<Record<string, { raw?: number }>>): YahooBilanzSnapshot[] {
  const daten: YahooBilanzSnapshot[] = []
  for (const row of rows) {
    const datum = isoAusEndDate(row.endDate?.raw)
    if (!datum) continue

    const longTerm = rawNum(row, 'longTermDebt')
    const shortTerm = rawNum(row, 'shortLongTermDebt') ?? rawNum(row, 'shortTermDebt')
    const totalDebt =
      rawNum(row, 'totalDebt') ??
      (longTerm != null || shortTerm != null ? (longTerm ?? 0) + (shortTerm ?? 0) : null)

    daten.push({
      datum,
      stockholdersEquityUsd: rawNum(row, 'totalStockholderEquity') ?? rawNum(row, 'commonStock'),
      totalDebtUsd: totalDebt,
      deferredTaxLiabilitiesNonCurrentUsd:
        rawNum(row, 'deferredLongTermLiabilities') ??
        rawNum(row, 'deferredTaxLiabilitiesNonCurrent') ??
        rawNum(row, 'nonCurrentDeferredTaxes'),
      deferredTaxLiabilitiesCurrentUsd:
        rawNum(row, 'deferredTaxLiabilitiesCurrent') ?? rawNum(row, 'currentDeferredTaxes'),
    })
  }
  daten.sort((a, b) => a.datum.localeCompare(b.datum))
  return daten
}

export async function ladeYahooBalanceSheetHistorie(symbol: string): Promise<YahooBilanzSnapshot[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const hit = cache.get(sym)
  if (hit && hit.at + CACHE_MS > Date.now()) return hit.daten

  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'balanceSheetHistory,balanceSheetHistoryQuarterly')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), daten: [] })
      return []
    }

    const j = (await res.json()) as {
      quoteSummary?: {
        result?: Array<{
          balanceSheetHistory?: { balanceSheetStatements?: Array<Record<string, { raw?: number }>> }
          balanceSheetHistoryQuarterly?: { balanceSheetStatements?: Array<Record<string, { raw?: number }>> }
        }>
      }
    }

    const row = j.quoteSummary?.result?.[0]
    const annual = parseBalanceRows(row?.balanceSheetHistory?.balanceSheetStatements ?? [])
    const quarterly = parseBalanceRows(row?.balanceSheetHistoryQuarterly?.balanceSheetStatements ?? [])

    const byDate = new Map<string, YahooBilanzSnapshot>()
    for (const b of [...annual, ...quarterly]) {
      byDate.set(b.datum, b)
    }
    const daten = [...byDate.values()].sort((a, b) => a.datum.localeCompare(b.datum))

    cache.set(sym, { at: Date.now(), daten })
    return daten
  } catch {
    cache.set(sym, { at: Date.now(), daten: [] })
    return []
  }
}

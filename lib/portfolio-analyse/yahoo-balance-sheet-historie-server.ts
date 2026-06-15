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

type TimeseriesBlock = {
  meta?: { type?: string[] }
  [key: string]: unknown
}

type TimeseriesPunkt = {
  asOfDate?: string
  reportedValue?: { raw?: number }
}

const BALANCE_TYPES = [
  'annualStockholdersEquity',
  'annualLongTermDebt',
  'annualCurrentDebt',
  'annualTotalDebt',
  'annualNonCurrentDeferredTaxesLiabilities',
  'annualCurrentDeferredTaxesLiabilities',
] as const

const BALANCE_FELDER: Record<
  keyof Omit<YahooBilanzSnapshot, 'datum'>,
  (typeof BALANCE_TYPES)[number]
> = {
  stockholdersEquityUsd: 'annualStockholdersEquity',
  totalDebtUsd: 'annualTotalDebt',
  deferredTaxLiabilitiesNonCurrentUsd: 'annualNonCurrentDeferredTaxesLiabilities',
  deferredTaxLiabilitiesCurrentUsd: 'annualCurrentDeferredTaxesLiabilities',
}

function blockFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesBlock | undefined {
  return result.find((b) => b.meta?.type?.[0] === typ)
}

function punkteFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesPunkt[] {
  const block = blockFuerTyp(result, typ)
  const t = block?.meta?.type?.[0]
  if (!t || !Array.isArray(block?.[t])) return []
  return block[t] as TimeseriesPunkt[]
}

function rawWert(p: TimeseriesPunkt | undefined): number | null {
  const raw = p?.reportedValue?.raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function isoAusAsOfDate(asOfDate: string | undefined): string | null {
  if (!asOfDate) return null
  const m = asOfDate.match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

function baueSnapshotsAusTimeseries(result: TimeseriesBlock[]): YahooBilanzSnapshot[] {
  const datenProTyp = new Map<string, TimeseriesPunkt[]>()
  for (const [feld, typ] of Object.entries(BALANCE_FELDER)) {
    datenProTyp.set(feld, punkteFuerTyp(result, typ))
  }
  datenProTyp.set('longTermDebtUsd', punkteFuerTyp(result, 'annualLongTermDebt'))
  datenProTyp.set('currentDebtUsd', punkteFuerTyp(result, 'annualCurrentDebt'))

  const referenz = datenProTyp.get('stockholdersEquityUsd') ?? datenProTyp.get('totalDebtUsd') ?? []
  const out: YahooBilanzSnapshot[] = []

  for (let i = 0; i < referenz.length; i++) {
    const datum = isoAusAsOfDate(referenz[i]?.asOfDate)
    if (!datum) continue

    const equity = rawWert(datenProTyp.get('stockholdersEquityUsd')?.[i])
    const ltDebt = rawWert(datenProTyp.get('longTermDebtUsd')?.[i])
    const stDebt = rawWert(datenProTyp.get('currentDebtUsd')?.[i])
    const totalDebtAnnual = rawWert(datenProTyp.get('totalDebtUsd')?.[i])
    const totalDebt =
      ltDebt != null || stDebt != null ? (ltDebt ?? 0) + (stDebt ?? 0) : totalDebtAnnual

    out.push({
      datum,
      stockholdersEquityUsd: equity,
      totalDebtUsd: totalDebt ?? null,
      deferredTaxLiabilitiesNonCurrentUsd: rawWert(
        datenProTyp.get('deferredTaxLiabilitiesNonCurrentUsd')?.[i],
      ),
      deferredTaxLiabilitiesCurrentUsd: rawWert(
        datenProTyp.get('deferredTaxLiabilitiesCurrentUsd')?.[i],
      ),
    })
  }

  return out.sort((a, b) => a.datum.localeCompare(b.datum))
}

async function ladeBalanceTimeseries(symbol: string): Promise<TimeseriesBlock[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const period1 = Math.floor(new Date('2010-01-01').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const u = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
  )
  u.searchParams.set('symbol', symbol)
  u.searchParams.set('type', BALANCE_TYPES.join(','))
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

/** Jahres-Bilanz (Equity, Schulden, latente Steuern) via Yahoo fundamentalsTimeSeries. */
export async function ladeYahooBalanceSheetHistorie(symbol: string): Promise<YahooBilanzSnapshot[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const hit = cache.get(sym)
  if (hit && hit.at + CACHE_MS > Date.now()) return hit.daten

  try {
    const result = await ladeBalanceTimeseries(sym)
    const daten = result.length > 0 ? baueSnapshotsAusTimeseries(result) : []
    cache.set(sym, { at: Date.now(), daten })
    return daten
  } catch {
    cache.set(sym, { at: Date.now(), daten: [] })
    return []
  }
}

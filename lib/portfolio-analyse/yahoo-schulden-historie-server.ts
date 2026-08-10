/**
 * Jahres-Schulden & Cash aus Yahoo fundamentals-timeseries.
 * Total Debt = kurzfristig + langfristig inkl. Capital Leases (Yahoo-Definition).
 */
import 'server-only'

import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; daten: YahooSchuldenJahr[] }>()

export type YahooSchuldenJahr = {
  datum: string
  /** Gesamtverschuldung inkl. Leases (USD). */
  totalDebtUsd: number | null
  /** Kurzfristige Schulden inkl. Leases (USD). */
  currentDebtUsd: number | null
  /** Langfristige Schulden inkl. Leases (USD). */
  longTermDebtUsd: number | null
  /** Cash + Short-Term Investments (USD) — Yahoo-EV-tauglich. */
  cashAndStiUsd: number | null
}

type TimeseriesBlock = {
  meta?: { type?: string[] }
  [key: string]: unknown
}

type TimeseriesPunkt = {
  asOfDate?: string
  reportedValue?: { raw?: number }
}

const DEBT_TYPES = [
  'annualTotalDebt',
  'annualCurrentDebt',
  'annualCurrentDebtAndCapitalLeaseObligation',
  'annualLongTermDebt',
  'annualLongTermDebtAndCapitalLeaseObligation',
  'annualCashCashEquivalentsAndShortTermInvestments',
  'annualCashAndCashEquivalents',
] as const

function blockFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesBlock | undefined {
  return result.find((b) => b.meta?.type?.[0] === typ)
}

function punkteAlsMap(result: TimeseriesBlock[], typ: string): Map<string, number> {
  const out = new Map<string, number>()
  const block = blockFuerTyp(result, typ)
  const t = block?.meta?.type?.[0]
  if (!t || !Array.isArray(block?.[t])) return out
  for (const p of block[t] as TimeseriesPunkt[]) {
    const iso = p.asOfDate?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
    const raw = p.reportedValue?.raw
    if (!iso || raw == null || !Number.isFinite(raw)) continue
    out.set(iso, raw)
  }
  return out
}

function firstDefined(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

function baueJahre(result: TimeseriesBlock[]): YahooSchuldenJahr[] {
  const total = punkteAlsMap(result, 'annualTotalDebt')
  const curPlain = punkteAlsMap(result, 'annualCurrentDebt')
  const curLease = punkteAlsMap(result, 'annualCurrentDebtAndCapitalLeaseObligation')
  const ltPlain = punkteAlsMap(result, 'annualLongTermDebt')
  const ltLease = punkteAlsMap(result, 'annualLongTermDebtAndCapitalLeaseObligation')
  const cashSti = punkteAlsMap(result, 'annualCashCashEquivalentsAndShortTermInvestments')
  const cashOnly = punkteAlsMap(result, 'annualCashAndCashEquivalents')

  const daten = new Set<string>([
    ...total.keys(),
    ...curPlain.keys(),
    ...curLease.keys(),
    ...ltPlain.keys(),
    ...ltLease.keys(),
    ...cashSti.keys(),
    ...cashOnly.keys(),
  ])

  const out: YahooSchuldenJahr[] = []
  for (const datum of [...daten].sort()) {
    const currentDebtUsd = firstDefined(curLease.get(datum), curPlain.get(datum))
    const longTermDebtUsd = firstDefined(ltLease.get(datum), ltPlain.get(datum))
    let totalDebtUsd = firstDefined(total.get(datum))
    if (totalDebtUsd == null && (currentDebtUsd != null || longTermDebtUsd != null)) {
      totalDebtUsd = (currentDebtUsd ?? 0) + (longTermDebtUsd ?? 0)
    }
    out.push({
      datum,
      totalDebtUsd,
      currentDebtUsd,
      longTermDebtUsd,
      cashAndStiUsd: firstDefined(cashSti.get(datum), cashOnly.get(datum)),
    })
  }
  return out
}

async function ladeDebtTimeseries(symbol: string): Promise<TimeseriesBlock[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const period1 = Math.floor(new Date('2005-01-01').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const u = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
  )
  u.searchParams.set('symbol', symbol)
  u.searchParams.set('type', DEBT_TYPES.join(','))
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

/** Jahres-Schulden/Cash via Yahoo (datumssicher gemappt). */
export async function ladeYahooSchuldenHistorie(symbol: string): Promise<YahooSchuldenJahr[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const hit = cache.get(sym)
  if (hit && hit.at + CACHE_MS > Date.now()) return hit.daten

  try {
    const result = await ladeDebtTimeseries(sym)
    const daten = result.length > 0 ? baueJahre(result) : []
    cache.set(sym, { at: Date.now(), daten })
    return daten
  } catch {
    cache.set(sym, { at: Date.now(), daten: [] })
    return []
  }
}

const MATCH_TOLERANZ_MS = 45 * 24 * 3600 * 1000

/** Findet Yahoo-Jahr zur FY-ISO (±45 Tage, sonst gleiches Kalenderjahr). */
export function findeYahooSchuldenFuerIso(
  jahre: YahooSchuldenJahr[],
  iso: string,
): YahooSchuldenJahr | null {
  const exakt = jahre.find((j) => j.datum === iso)
  if (exakt) return exakt

  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best: YahooSchuldenJahr | null = null
  let bestDiff = Infinity
  for (const j of jahre) {
    const diff = Math.abs(new Date(`${j.datum}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= MATCH_TOLERANZ_MS) {
      bestDiff = diff
      best = j
    }
  }
  if (best) return best

  const jahr = iso.slice(0, 4)
  const gleiche = jahre.filter((j) => j.datum.startsWith(jahr)).sort((a, b) => b.datum.localeCompare(a.datum))
  return gleiche[0] ?? null
}

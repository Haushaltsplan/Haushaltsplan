/**
 * Incremental ROIC — Yahoo-Jahresreihe + Nasdaq Company Financials (US).
 */

import 'server-only'

import { effektiverSteuersatz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  berechneIncrementalRoicAusYahoo,
  paketAusSnaps,
  type IncrementalRoicPaket,
  type JahrSnap,
  type JahrSnapErweitert,
} from '@/lib/portfolio-analyse/incremental-roic'
import {
  ladeStockanalysisStatementsRoh,
  snapsFuerIncrementalRoic,
} from '@/lib/portfolio-analyse/stockanalysis-statements-server'

export type { IncrementalRoicPaket }
export { berechneIncrementalRoicAusYahoo }

const CACHE_MS = 12 * 60 * 60 * 1000
const nasdaqCache = new Map<string, { at: number; data: JahrSnap[] | null }>()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseNasdaqZahl(raw: string | null | undefined): number | null {
  if (!raw || raw === '--' || raw === '-') return null
  const n = Number(String(raw).replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n)) return null
  return n / 1000
}

type NasdaqTable = {
  headers?: Record<string, string>
  rows?: Array<Record<string, string>>
}

function jahrAusHeader(headers: Record<string, string> | undefined): Map<string, number> {
  const map = new Map<string, number>()
  if (!headers) return map
  for (const [k, v] of Object.entries(headers)) {
    if (k === 'value1') continue
    const m = String(v).match(/(\d{4})/)
    if (m) map.set(k, parseInt(m[1]!, 10))
  }
  return map
}

function zeile(
  rows: Array<Record<string, string>> | undefined,
  ...labels: string[]
): Record<string, string> | undefined {
  if (!rows) return undefined
  return rows.find((r) => labels.some((l) => (r.value1 ?? '').toLowerCase() === l.toLowerCase()))
}

/** Nasdaq.com Company Financials — US-Titel, ohne API-Key. */
export async function ladeIncrementalRoicVonNasdaq(
  symbol: string,
): Promise<IncrementalRoicPaket | null> {
  const sym = symbol.trim().toUpperCase().split('.')[0] ?? ''
  if (!sym || !/^[A-Z]{1,5}$/.test(sym)) return null

  const hit = nasdaqCache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.data ? paketAusSnaps(hit.data, 'nasdaq') : null
  }

  try {
    const url = `https://api.nasdaq.com/api/company/${encodeURIComponent(sym)}/financials?frequency=1`
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Origin: 'https://www.nasdaq.com',
        Referer: 'https://www.nasdaq.com/',
      },
      signal: AbortSignal.timeout(18_000),
      cache: 'no-store',
    })
    if (!res.ok) {
      nasdaqCache.set(sym, { at: Date.now(), data: null })
      return null
    }
    const j = (await res.json()) as {
      data?: {
        incomeStatementTable?: NasdaqTable
        balanceSheetTable?: NasdaqTable
      }
    }
    const inc = j.data?.incomeStatementTable
    const bal = j.data?.balanceSheetTable
    const jahre = jahrAusHeader(inc?.headers)
    if (jahre.size < 2) {
      nasdaqCache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const oi = zeile(inc?.rows, 'Operating Income')
    const pretax = zeile(inc?.rows, 'Income Before Tax', 'Income Before Taxes', 'Pre-Tax Income')
    const tax = zeile(inc?.rows, 'Income Tax', 'Income Taxes', 'Provision for Income Taxes')
    const equity = zeile(bal?.rows, 'Total Equity', 'Total Stockholders Equity')
    const debt = zeile(bal?.rows, 'Long-Term Debt', 'Long Term Debt')
    const cash = zeile(bal?.rows, 'Cash and Cash Equivalents', 'Cash')

    const snaps: JahrSnap[] = []
    for (const [col, jahr] of jahre) {
      const oiV = parseNasdaqZahl(oi?.[col])
      if (oiV == null) continue
      const pretaxV = parseNasdaqZahl(pretax?.[col])
      const taxV = parseNasdaqZahl(tax?.[col])
      const t = effektiverSteuersatz(
        pretaxV != null ? pretaxV * 1_000_000 : null,
        taxV != null ? taxV * 1_000_000 : null,
      )
      const eq = parseNasdaqZahl(equity?.[col])
      const d = parseNasdaqZahl(debt?.[col])
      const c = parseNasdaqZahl(cash?.[col])
      if (eq == null) continue
      snaps.push({
        jahr,
        nopatMio: Math.round(oiV * (1 - t) * 10) / 10,
        icMio: Math.round((eq + (d ?? 0) - (c ?? 0)) * 10) / 10,
      })
    }

    snaps.sort((a, b) => a.jahr - b.jahr)
    nasdaqCache.set(sym, { at: Date.now(), data: snaps.length >= 2 ? snaps : null })
    return snaps.length >= 2 ? paketAusSnaps(snaps, 'nasdaq') : null
  } catch {
    nasdaqCache.set(sym, { at: Date.now(), data: null })
    return null
  }
}

/** Yahoo + Nasdaq + StockAnalysis — längeres Fenster / weniger Extremwert gewinnt. */
export async function ladeIncrementalRoic(opts: {
  symbolYahoo: string
  yahooHistorie?: YahooJahresSnapshot[] | null
  isin?: string | null
  ticker?: string | null
  firmenname?: string | null
}): Promise<IncrementalRoicPaket> {
  const leer: IncrementalRoicPaket = {
    incrementalRoicPct: null,
    incrementalRoic1yPct: null,
    incrementalRoic5yPct: null,
    fensterJahre: null,
    quelle: null,
  }

  const bare = opts.symbolYahoo.trim().toUpperCase().split('.')[0] ?? ''
  const [ausYahoo, ausNasdaq, saRoh] = await Promise.all([
    Promise.resolve(berechneIncrementalRoicAusYahoo(opts.yahooHistorie)),
    ladeIncrementalRoicVonNasdaq(bare),
    ladeStockanalysisStatementsRoh({
      symbolYahoo: opts.symbolYahoo,
      isin: opts.isin,
      ticker: opts.ticker,
      firmenname: opts.firmenname,
    }),
  ])

  const saSnaps: JahrSnapErweitert[] = snapsFuerIncrementalRoic(saRoh).map((s) => ({
    jahr: s.jahr,
    nopatMio: s.nopatMio,
    icMio: s.icMio,
    capexMio: s.capexMio,
    daMio: s.daMio,
  }))
  const ausSa = saSnaps.length >= 2 ? paketAusSnaps(saSnaps, 'stockanalysis') : null

  const kandidaten = [ausYahoo, ausNasdaq, ausSa].filter(
    (p): p is IncrementalRoicPaket => p != null && p.incrementalRoicPct != null,
  )
  if (kandidaten.length === 0) return leer

  kandidaten.sort((a, b) => {
    const fa = a.fensterJahre ?? 0
    const fb = b.fensterJahre ?? 0
    if (fb !== fa) return fb - fa
    return Math.abs(a.incrementalRoicPct!) - Math.abs(b.incrementalRoicPct!)
  })
  return kandidaten[0]!
}

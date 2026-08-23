/**
 * Incremental ROIC — Yahoo / Nasdaq / StockAnalysis.
 * Methodik: organisch (ΔNOPAT/CapEx) vor tangible/book; M&A-Goodwill-Fenster verwerfen.
 */

import 'server-only'

import { effektiverSteuersatz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  berechneIncrementalRoicAusYahoo,
  paketAusSnaps,
  type IncrementalRoicPaket,
  type JahrSnapErweitert,
} from '@/lib/portfolio-analyse/incremental-roic'
import {
  ladeStockanalysisStatementsRoh,
  snapsFuerIncrementalRoic,
} from '@/lib/portfolio-analyse/stockanalysis-statements-server'

export type { IncrementalRoicPaket }
export { berechneIncrementalRoicAusYahoo }

const CACHE_MS = 12 * 60 * 60 * 1000
const nasdaqCache = new Map<string, { at: number; data: JahrSnapErweitert[] | null }>()

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseNasdaqZahl(raw: string | null | undefined): number | null {
  if (!raw || raw === '--' || raw === '-') return null
  const n = Number(String(raw).replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n)) return null
  return n / 1000 // Nasdaq: Tausend USD → Mio.
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

function leerPaket(): IncrementalRoicPaket {
  return {
    incrementalRoicPct: null,
    incrementalRoic1yPct: null,
    incrementalRoic5yPct: null,
    fensterJahre: null,
    quelle: null,
    methode: null,
  }
}

/** Nasdaq.com Company Financials — inkl. Goodwill/Intangibles/CapEx. */
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
        cashFlowTable?: NasdaqTable
      }
    }
    const inc = j.data?.incomeStatementTable
    const bal = j.data?.balanceSheetTable
    const cf = j.data?.cashFlowTable
    const jahre = jahrAusHeader(inc?.headers)
    if (jahre.size < 2) {
      nasdaqCache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const oi = zeile(inc?.rows, 'Operating Income')
    const pretax = zeile(inc?.rows, 'Income Before Tax', 'Income Before Taxes', 'Pre-Tax Income')
    const tax = zeile(inc?.rows, 'Income Tax', 'Income Taxes', 'Provision for Income Taxes')
    const equity = zeile(bal?.rows, 'Total Equity', 'Total Stockholders Equity')
    const debt = zeile(
      bal?.rows,
      'Total Debt',
      'Long-Term Debt',
      'Long Term Debt',
      'Long-term Debt',
    )
    const cash = zeile(bal?.rows, 'Cash and Cash Equivalents', 'Cash')
    const gw = zeile(bal?.rows, 'Goodwill')
    const inta = zeile(bal?.rows, 'Intangible Assets', 'Intangibles')
    const capex = zeile(
      cf?.rows,
      'Capital Expenditures',
      'Capital Expenditure',
      'Purchases of Property, Plant and Equipment',
    )
    const da = zeile(
      cf?.rows,
      'Depreciation and Amortization',
      'Depreciation/Amortization',
      'Depreciation & Amortization',
    )

    const snaps: JahrSnapErweitert[] = []
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
        capexMio: (() => {
          const v = parseNasdaqZahl(capex?.[col])
          return v != null ? Math.abs(v) : null
        })(),
        daMio: (() => {
          const v = parseNasdaqZahl(da?.[col])
          return v != null ? Math.abs(v) : null
        })(),
        goodwillMio: parseNasdaqZahl(gw?.[col]),
        intangiblesMio: parseNasdaqZahl(inta?.[col]),
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

function methodePrio(p: IncrementalRoicPaket): number {
  if (p.methode === 'organic_capex') return 0
  if (p.methode === 'tangible_ic') return 1
  if (p.methode === 'book_ic') return 2
  return 3
}

/** Yahoo + Nasdaq + StockAnalysis — organische Methode bevorzugt. */
export async function ladeIncrementalRoic(opts: {
  symbolYahoo: string
  yahooHistorie?: YahooJahresSnapshot[] | null
  isin?: string | null
  ticker?: string | null
  firmenname?: string | null
}): Promise<IncrementalRoicPaket> {
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
    goodwillMio: s.goodwillMio,
    intangiblesMio: s.intangiblesMio,
  }))
  const ausSa = saSnaps.length >= 2 ? paketAusSnaps(saSnaps, 'stockanalysis') : null

  const kandidaten = [ausYahoo, ausNasdaq, ausSa].filter(
    (p): p is IncrementalRoicPaket => p != null && p.incrementalRoicPct != null,
  )
  if (kandidaten.length === 0) return leerPaket()

  kandidaten.sort((a, b) => {
    const ma = methodePrio(a)
    const mb = methodePrio(b)
    if (ma !== mb) return ma - mb
    const fa = a.fensterJahre ?? 0
    const fb = b.fensterJahre ?? 0
    // 3–5J bevorzugen
    const score = (f: number) => (f >= 3 && f <= 5 ? 0 : f === 2 ? 1 : f === 1 ? 3 : 2)
    if (score(fa) !== score(fb)) return score(fa) - score(fb)
    return Math.abs(a.incrementalRoicPct!) - Math.abs(b.incrementalRoicPct!)
  })
  return kandidaten[0]!
}

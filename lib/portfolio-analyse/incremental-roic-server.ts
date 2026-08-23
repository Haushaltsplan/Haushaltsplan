/**
 * Incremental ROIC — GuruFocus-Formel (ΔNOPAT/ΔIC, 5J) aus SA/Nasdaq/Yahoo.
 * Optional: GuruFocus HTML/API wenn erreichbar.
 */

import 'server-only'

import { effektiverSteuersatz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  berechneRoiicAusSnaps,
  berechneIncrementalRoicAusYahoo,
  type IncrementalRoicPaket,
  type JahrSnapErweitert,
} from '@/lib/portfolio-analyse/incremental-roic'
import { ladeIncrementalRoicVonGuruFocus } from '@/lib/portfolio-analyse/gurufocus-incremental-roic-server'
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

function leer(): IncrementalRoicPaket {
  return {
    incrementalRoicPct: null,
    incrementalRoic1yPct: null,
    incrementalRoic5yPct: null,
    fensterJahre: null,
    quelle: null,
    methode: null,
  }
}

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
    return hit.data ? berechneRoiicAusSnaps(hit.data, 'nasdaq') : null
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
    const goodwill = zeile(bal?.rows, 'Goodwill')
    const intangibles = zeile(bal?.rows, 'Intangible Assets')
    const capex = zeile(j.data?.cashFlowTable?.rows, 'Capital Expenditures', 'Capital Expenditure')

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
        goodwillMio: parseNasdaqZahl(goodwill?.[col]),
        intangiblesMio: parseNasdaqZahl(intangibles?.[col]),
        capexMio: (() => {
          const v = parseNasdaqZahl(capex?.[col])
          return v != null ? Math.abs(v) : null
        })(),
        daMio: null,
      })
    }

    snaps.sort((a, b) => a.jahr - b.jahr)
    nasdaqCache.set(sym, { at: Date.now(), data: snaps.length >= 2 ? snaps : null })
    return snaps.length >= 2 ? berechneRoiicAusSnaps(snaps, 'nasdaq') : null
  } catch {
    nasdaqCache.set(sym, { at: Date.now(), data: null })
    return null
  }
}

function hatWert(p: IncrementalRoicPaket | null | undefined): p is IncrementalRoicPaket {
  return p != null && p.incrementalRoicPct != null
}

/** GuruFocus (Scrape/API) → StockAnalysis → Nasdaq → Yahoo. */
export async function ladeIncrementalRoic(opts: {
  symbolYahoo: string
  yahooHistorie?: YahooJahresSnapshot[] | null
  isin?: string | null
  ticker?: string | null
  firmenname?: string | null
}): Promise<IncrementalRoicPaket> {
  const bare = opts.symbolYahoo.trim().toUpperCase().split('.')[0] ?? ''

  const [ausGuruFocus, ausYahoo, ausNasdaq, saRoh] = await Promise.all([
    ladeIncrementalRoicVonGuruFocus({
      symbolYahoo: opts.symbolYahoo,
      isin: opts.isin,
      ticker: opts.ticker,
    }),
    Promise.resolve(berechneIncrementalRoicAusYahoo(opts.yahooHistorie)),
    ladeIncrementalRoicVonNasdaq(bare),
    ladeStockanalysisStatementsRoh({
      symbolYahoo: opts.symbolYahoo,
      isin: opts.isin,
      ticker: opts.ticker,
      firmenname: opts.firmenname,
    }),
  ])

  if (hatWert(ausGuruFocus)) return ausGuruFocus

  const saSnaps = snapsFuerIncrementalRoic(saRoh)
  const ausSa =
    saSnaps.length >= 2 ? berechneRoiicAusSnaps(saSnaps, 'stockanalysis') : leer()

  const kandidaten = [ausSa, ausNasdaq, ausYahoo].filter(hatWert)
  if (kandidaten.length === 0) return leer()

  const prio = (q: IncrementalRoicPaket['quelle']) =>
    q === 'stockanalysis' ? 0 : q === 'nasdaq' ? 1 : 2

  kandidaten.sort((a, b) => {
    const pa = prio(a.quelle)
    const pb = prio(b.quelle)
    if (pa !== pb) return pa - pb
    const fa = a.fensterJahre ?? 0
    const fb = b.fensterJahre ?? 0
    return fb - fa
  })
  return kandidaten[0]!
}

/** StockAnalysis URL-Kandidaten für /metrics/* (ohne server-only). */

import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type SaMetrikSuffix =
  | 'revenue-by-segment/'
  | 'revenue-by-geography/'
  | 'operating-income-by-segment/'

const YAHOO_SUFFIX_TO_EXCHANGE: Record<string, string> = {
  PA: 'epa',
  AS: 'ams',
  DE: 'etr',
  L: 'lon',
  SW: 'swx',
  MI: 'mil',
  MC: 'bme',
  ST: 'sto',
  HE: 'etr',
  HM: 'ham',
  TO: 'tsx',
  V: 'vie',
  SG: 'etr',
}

/** Bekannte /quote/{börse}/{symbol}/metrics/ — vor Yahoo-Suffix. */
const SA_QUOTE_METRICS_BASE: Record<string, string> = {
  HLMA: '/quote/lon/HLMA/metrics/',
  MUM: '/quote/etr/MUM/metrics/',
  ATD: '/quote/tsx/ATD/metrics/',
  SIKA: '/quote/swx/SIKA/metrics/',
  WKL: '/quote/ams/WKL/metrics/',
  STMN: '/quote/swx/STMN/metrics/',
}

export function saMetrikPfade(
  opts: {
    symbolYahoo?: string | null
    ticker?: string | null
    isin?: string | null
  },
  suffix: SaMetrikSuffix,
): string[] {
  const out: string[] = []
  const add = (p: string) => {
    const path = p.endsWith('/') ? `${p}${suffix}` : `${p}/${suffix}`
    if (!out.includes(path)) out.push(path)
  }

  const k = isinKenntnis(opts.isin?.trim().toUpperCase() ?? '')
  for (const key of [k?.logoSymbol, k?.macrotrendsTicker, opts.ticker, opts.symbolYahoo]) {
    const sym = key?.trim().toUpperCase()
    if (!sym) continue
    const base = SA_QUOTE_METRICS_BASE[sym]
    if (base) add(base)
    add(`/stocks/${sym.toLowerCase()}/metrics/`)
    if (k?.macrotrendsSlug) add(`/stocks/${k.macrotrendsSlug}/metrics/`)
  }

  const yahoo = opts.symbolYahoo?.trim().toUpperCase() ?? ''
  if (yahoo.includes('.')) {
    const [base, suf] = yahoo.split('.')
    const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
    if (ex && base) add(`/quote/${ex}/${base}/metrics/`)
    if (base) add(`/stocks/${base.toLowerCase()}/metrics/`)
  } else if (yahoo) {
    add(`/stocks/${yahoo.toLowerCase()}/metrics/`)
    add(`/quote/us/${yahoo}/metrics/`)
  }

  const ticker = opts.ticker?.trim().toUpperCase()
  if (ticker && ticker !== yahoo && !ticker.includes('.')) {
    add(`/quote/us/${ticker}/metrics/`)
    add(`/stocks/${ticker.toLowerCase()}/metrics/`)
  }

  return out
}

/** /metrics/ Hauptseite (RPO etc.) — ohne revenue-by-* Suffix. */
export function saMetricsHauptPfade(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  isin?: string | null
}): string[] {
  const segmentPfade = saMetrikPfade(opts, 'revenue-by-segment/')
  const out: string[] = []
  for (const p of segmentPfade) {
    const base = p.replace(/revenue-by-segment\/$/, '')
    if (base && !out.includes(base)) out.push(base)
  }
  return out
}

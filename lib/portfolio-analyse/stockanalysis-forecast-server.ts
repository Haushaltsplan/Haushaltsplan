import 'server-only'

import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 200

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
  SG: 'etr',
  TO: 'tsx',
  V: 'vie',
}

type SearchHit = { id?: string; s?: string; t?: string; n?: string; st?: string }

export type StockanalysisJahresForecastEintrag = {
  jahr: number
  periodenEnde: string
  umsatzUsd: number | null
  operatingIncomeUsd: number | null
  netIncomeUsd: number | null
  freeCashFlowUsd: number | null
  grossProfitUsd: number | null
  eps: number | null
  adjustedEps: number | null
  grossMarginPct: number | null
  revenueGrowthPct: number | null
  epsGrowthPct: number | null
  istSchätzung: boolean
}

export type StockanalysisJahresForecast = {
  quelle: 'stockanalysis'
  url: string
  fy0Jahr: number | null
  fy1Jahr: number | null
  umsatzUsdFy0: number | null
  umsatzUsdFy1: number | null
  umsatzWachstumFy0Pct: number | null
  umsatzWachstumFy1Pct: number | null
  epsFy0: number | null
  epsFy1: number | null
  epsWachstumFy0Pct: number | null
  epsWachstumFy1Pct: number | null
  /** Alle verfügbaren Jahreswerte (Ist + Schätzungen, soweit gescraped). */
  jahresreihe: StockanalysisJahresForecastEintrag[]
}

const cache = new Map<string, { at: number; daten: StockanalysisJahresForecast | null }>()
let letzterAbruf = 0

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const warten = MIN_ABSTAND_MS - (Date.now() - letzterAbruf)
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()
}

async function fetchHtml(path: string): Promise<string | null> {
  await throttle()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function parseTriple(block: string, key: string): { last: number; this: number; growth: number } | null {
  const m = block.match(new RegExp(`${key}:\\{last:([\\d.]+),this:([\\d.]+),growth:([\\d.]+)\\}`))
  if (!m) return null
  const last = Number(m[1])
  const cur = Number(m[2])
  const growth = Number(m[3])
  if (!Number.isFinite(cur)) return null
  return {
    last: Number.isFinite(last) ? last : cur,
    this: cur,
    growth: Number.isFinite(growth) ? growth : 0,
  }
}

function parseArrayLiteral(block: string, key: string): unknown[] | null {
  const marker = `${key}:`
  const idx = block.indexOf(marker)
  if (idx < 0) return null
  const start = block.indexOf('[', idx)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < block.length; i++) {
    const ch = block[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '[') depth++
    if (ch === ']') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(block.slice(start, i + 1)) as unknown[]
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function parseZahl(raw: unknown): number | null {
  if (raw == null || raw === '' || raw === '[PRO]') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseString(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).replace(/"/g, '').trim()
  return s.length > 0 ? s : null
}

function extrahiereAnnualBlock(html: string): string | null {
  const anchor = 'fiscalYear:["'
  const idx = html.indexOf(anchor)
  if (idx < 0) return null
  const start = html.lastIndexOf('annual:{', idx)
  if (start >= 0) {
    let depth = 0
    for (let i = start + 'annual:{'.length - 1; i < html.length; i++) {
      if (html[i] === '{') depth++
      if (html[i] === '}') {
        depth--
        if (depth === 0) return html.slice(start + 'annual:'.length, i + 1)
      }
    }
  }
  const end =
    html.indexOf('},annual:{', idx) >= 0
      ? html.indexOf('},annual:{', idx) + 1
      : html.indexOf('},quarterly:{', idx) >= 0
        ? html.indexOf('},quarterly:{', idx) + 1
        : Math.min(html.length, idx + 60_000)
  return `{${html.slice(idx, end)}}`
}

function dedupeJahresreiheNachJahr(
  reihe: StockanalysisJahresForecastEintrag[],
): StockanalysisJahresForecastEintrag[] {
  const byYear = new Map<number, StockanalysisJahresForecastEintrag>()
  for (const r of reihe) {
    const cur = byYear.get(r.jahr)
    if (!cur) {
      byYear.set(r.jahr, r)
      continue
    }
    const curRev = cur.umsatzUsd ?? 0
    const neuRev = r.umsatzUsd ?? 0
    if (neuRev >= curRev) byYear.set(r.jahr, r)
  }
  return [...byYear.values()].sort((a, b) => a.jahr - b.jahr)
}

function baueJahresreiheAusAnnual(block: string): StockanalysisJahresForecastEintrag[] {
  const years = (parseArrayLiteral(block, 'fiscalYear') ?? [])
    .map((y) => Number(parseString(y)))
    .filter((y) => Number.isFinite(y) && y > 2000)
  const dates = (parseArrayLiteral(block, 'dates') ?? []).map((d) => parseString(d))
  const revenue = parseArrayLiteral(block, 'revenue') ?? []
  const operatingIncome = parseArrayLiteral(block, 'operatingIncome') ?? []
  const netIncome = parseArrayLiteral(block, 'netIncome') ?? []
  const freeCashFlow = parseArrayLiteral(block, 'freeCashFlow') ?? []
  const grossProfit = parseArrayLiteral(block, 'grossProfit') ?? []
  const eps = parseArrayLiteral(block, 'eps') ?? []
  const adjustedEps = parseArrayLiteral(block, 'adjustedEps') ?? []
  const grossMargin = parseArrayLiteral(block, 'grossMargin') ?? []
  const revenueGrowth = parseArrayLiteral(block, 'revenueGrowth') ?? []
  const epsGrowth = parseArrayLiteral(block, 'epsGrowth') ?? []

  const n = years.length
  if (n === 0) return []

  let schaetzStartIdx = adjustedEps.findIndex((v) => parseZahl(v) != null)
  if (schaetzStartIdx < 0) {
    const nowYear = new Date().getFullYear()
    schaetzStartIdx = years.findIndex((y) => y > nowYear - 1)
    if (schaetzStartIdx < 0) schaetzStartIdx = n
  }

  const out: StockanalysisJahresForecastEintrag[] = []
  for (let i = 0; i < n; i++) {
    const jahr = years[i]!
    const umsatzUsd = parseZahl(revenue[i])
    const operatingIncomeUsd = parseZahl(operatingIncome[i])
    const netIncomeUsd = parseZahl(netIncome[i])
    const freeCashFlowUsd = parseZahl(freeCashFlow[i])
    const grossProfitUsd = parseZahl(grossProfit[i])
    const epsVal = parseZahl(eps[i])
    const adjEps = parseZahl(adjustedEps[i])
    const grossMarginPct = parseZahl(grossMargin[i])
    const revenueGrowthPct = parseZahl(revenueGrowth[i])
    const epsGrowthPct = parseZahl(epsGrowth[i])

    const hatWert =
      umsatzUsd != null ||
      operatingIncomeUsd != null ||
      netIncomeUsd != null ||
      freeCashFlowUsd != null ||
      grossProfitUsd != null ||
      epsVal != null ||
      adjEps != null
    if (!hatWert && i < schaetzStartIdx) continue

    const periodenEnde =
      dates[i]?.match(/^\d{4}-\d{2}-\d{2}$/) ? dates[i]! : `${jahr}-12-31`

    out.push({
      jahr,
      periodenEnde,
      umsatzUsd,
      operatingIncomeUsd,
      netIncomeUsd,
      freeCashFlowUsd,
      grossProfitUsd,
      eps: adjEps ?? epsVal,
      adjustedEps: adjEps,
      grossMarginPct,
      revenueGrowthPct,
      epsGrowthPct,
      istSchätzung: i >= schaetzStartIdx,
    })
  }
  return dedupeJahresreiheNachJahr(out)
}

function kandidatenFinanzPfade(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  isin?: string | null
}): string[] {
  const out: string[] = []
  const add = (p: string) => {
    if (p && !out.includes(p)) out.push(p)
  }

  const sym = opts.symbolYahoo?.trim().toUpperCase() ?? ''
  if (sym.includes('.')) {
    const [base, suf] = sym.split('.')
    const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
    if (ex && base) add(`/quote/${ex}/${base}/financials/`)
  } else if (sym) {
    add(`/stocks/${sym.toLowerCase()}/financials/`)
  }

  for (const pfad of kandidatenForecastPfade(opts)) {
    add(forecastPfadAusBasis(pfad.replace(/forecast\/?$/, '')))
  }

  return out
}

/** Historische GuV/Cashflow-Jahre von StockAnalysis /financials/ oder /forecast/. */
export async function ladeStockanalysisGuVHistorie(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  firmenname?: string | null
  isin?: string | null
}): Promise<StockanalysisJahresForecastEintrag[]> {
  for (const pfad of kandidatenFinanzPfade(opts)) {
    const html = await fetchHtml(pfad)
    if (!html) continue
    const block = extrahiereAnnualBlock(html)
    if (!block) continue
    const reihe = dedupeJahresreiheNachJahr(baueJahresreiheAusAnnual(block)).filter((j) => !j.istSchätzung)
    if (reihe.length >= 2) return reihe
  }

  const forecast = await ladeStockanalysisJahresForecast(opts)
  if (!forecast?.jahresreihe.length) return []
  return dedupeJahresreiheNachJahr(forecast.jahresreihe).filter((j) => !j.istSchätzung)
}

function parseForecastAusHtml(html: string, url: string): StockanalysisJahresForecast | null {
  const revThis = parseTriple(html, 'revenueThis')
  const revNext = parseTriple(html, 'revenueNext')
  const epsThis = parseTriple(html, 'epsThis')
  const epsNext = parseTriple(html, 'epsNext')

  const annualBlock = extrahiereAnnualBlock(html)
  const jahresreihe = annualBlock ? baueJahresreiheAusAnnual(annualBlock) : []
  const schaetzungen = jahresreihe.filter((j) => j.istSchätzung)

  if (!revThis && !revNext && !epsThis && !epsNext && schaetzungen.length === 0) return null

  const fy0 = schaetzungen[0]
  const fy1 = schaetzungen[1]

  return {
    quelle: 'stockanalysis',
    url,
    fy0Jahr: fy0?.jahr ?? null,
    fy1Jahr: fy1?.jahr ?? null,
    umsatzUsdFy0: fy0?.umsatzUsd ?? revThis?.this ?? null,
    umsatzUsdFy1: fy1?.umsatzUsd ?? revNext?.this ?? null,
    umsatzWachstumFy0Pct: fy0?.revenueGrowthPct ?? revThis?.growth ?? null,
    umsatzWachstumFy1Pct: fy1?.revenueGrowthPct ?? revNext?.growth ?? null,
    epsFy0: fy0?.eps ?? epsThis?.this ?? null,
    epsFy1: fy1?.eps ?? epsNext?.this ?? null,
    epsWachstumFy0Pct: fy0?.epsGrowthPct ?? epsThis?.growth ?? null,
    epsWachstumFy1Pct: fy1?.epsGrowthPct ?? epsNext?.growth ?? null,
    jahresreihe,
  }
}

function forecastPfadAusBasis(basis: string): string {
  return basis.replace(/\/financials\/?$/, '/forecast/')
}

function kandidatenForecastPfade(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  isin?: string | null
}): string[] {
  const out: string[] = []
  const add = (p: string) => {
    if (p && !out.includes(p)) out.push(p)
  }

  const sym = opts.symbolYahoo?.trim().toUpperCase() ?? ''
  if (sym.includes('.')) {
    const [base, suf] = sym.split('.')
    const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
    if (ex && base) add(`/quote/${ex}/${base}/forecast/`)
  } else if (sym) {
    add(`/stocks/${sym.toLowerCase()}/forecast/`)
  }

  const ticker = opts.ticker?.trim().toUpperCase()
  if (ticker && ticker !== sym) add(`/stocks/${ticker.toLowerCase()}/forecast/`)

  const k = isinKenntnis(opts.isin?.trim().toUpperCase() ?? '')
  if (k?.symbolYahoo) {
    const ks = k.symbolYahoo.toUpperCase()
    if (ks !== sym) {
      if (ks.includes('.')) {
        const [base, suf] = ks.split('.')
        const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
        if (ex && base) add(`/quote/${ex}/${base}/forecast/`)
      } else {
        add(`/stocks/${ks.toLowerCase()}/forecast/`)
      }
    }
  }

  return out
}

function ratiosPfadAusHit(hit: SearchHit): string | null {
  const s = hit.s?.trim()
  if (!s) return null
  if (s.includes('/')) return `/quote/${s.toLowerCase()}/financials/ratios/`
  return `/stocks/${s.toLowerCase()}/financials/ratios/`
}

async function sucheStockanalysisHits(query: string): Promise<SearchHit[]> {
  if (!query.trim()) return []
  await throttle()
  try {
    const u = new URL(`${BASE}/api/search`)
    u.searchParams.set('q', query.trim())
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const j = (await res.json()) as { data?: SearchHit[] }
    return j.data ?? []
  } catch {
    return []
  }
}

function waehleSearchHit(hits: SearchHit[], symbolYahoo: string | null): SearchHit | null {
  const securities = hits.filter((h) => h.st === 's' || h.t === 'sy' || h.t === 's')
  if (securities.length === 0) return null
  const sym = symbolYahoo?.trim().toUpperCase() ?? ''
  if (sym.includes('.')) {
    const [base, suf] = sym.split('.')
    const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
    if (ex && base) {
      const ziel = `${ex}/${base}`.toLowerCase()
      const treffer = securities.find((h) => h.s?.toLowerCase() === ziel)
      if (treffer) return treffer
    }
  } else if (sym) {
    const treffer = securities.find((h) => h.s?.toUpperCase() === sym)
    if (treffer) return treffer
  }
  return securities[0] ?? null
}

/** Jahres-Konsens von StockAnalysis /forecast/ (mehrere Jahre, Umsatz/EPS/EBIT/FCF/…). */
export async function ladeStockanalysisJahresForecast(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  firmenname?: string | null
  isin?: string | null
}): Promise<StockanalysisJahresForecast | null> {
  const cacheKey = [
    opts.isin?.trim().toUpperCase() ?? '',
    opts.symbolYahoo?.trim().toUpperCase() ?? '',
    opts.ticker?.trim().toUpperCase() ?? '',
    opts.firmenname?.trim() ?? '',
  ].join('|')

  const hit = cache.get(cacheKey)
  if (hit && hit.at + CACHE_MS > Date.now()) return hit.daten

  for (const pfad of kandidatenForecastPfade(opts)) {
    const html = await fetchHtml(pfad)
    if (!html) continue
    const parsed = parseForecastAusHtml(html, `${BASE}${pfad}`)
    if (parsed) {
      cache.set(cacheKey, { at: Date.now(), daten: parsed })
      return parsed
    }
  }

  const suchQueries = [
    opts.firmenname?.trim() ?? '',
    opts.symbolYahoo?.split('.')[0]?.trim() ?? '',
    opts.ticker?.trim() ?? '',
  ].filter((q) => q.length >= 2)

  const seen = new Set<string>()
  for (const q of suchQueries) {
    const ql = q.toLowerCase()
    if (seen.has(ql)) continue
    seen.add(ql)

    const hits = await sucheStockanalysisHits(q)
    const searchHit = waehleSearchHit(hits, opts.symbolYahoo ?? null)
    const ratiosPfad = searchHit ? ratiosPfadAusHit(searchHit) : null
    if (!ratiosPfad) continue
    const basis = ratiosPfad.replace(/ratios\/?$/, '')
    const forecastPfad = forecastPfadAusBasis(basis)
    if (seen.has(forecastPfad)) continue
    seen.add(forecastPfad)

    const html = await fetchHtml(forecastPfad)
    if (!html) continue
    const parsed = parseForecastAusHtml(html, `${BASE}${forecastPfad}`)
    if (parsed) {
      cache.set(cacheKey, { at: Date.now(), daten: parsed })
      return parsed
    }
  }

  cache.set(cacheKey, { at: Date.now(), daten: null })
  return null
}

import 'server-only'

import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 24 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 200

/** Yahoo-Börsensuffix → StockAnalysis-Exchange (quote/{ex}/{ticker}/). */
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

type SearchHit = {
  id?: string
  s?: string
  t?: string
  n?: string
  st?: string
}

export type StockanalysisRoicDaten = {
  werte: Record<string, number>
  url: string
}

let letzterAbruf = 0
const cache = new Map<string, { at: number; daten: StockanalysisRoicDaten | null }>()

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const jetzt = Date.now()
  const warten = MIN_ABSTAND_MS - (jetzt - letzterAbruf)
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
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function parseRoicAusHtml(html: string): Record<string, number> | null {
  const m = html.match(/financialData:\{datekey:\[([^\]]+)\][\s\S]*?roic:\[([^\]]+)\]/)
  if (!m) return null

  const datekeys = m[1]
    .split(',')
    .map((s) => s.replace(/"/g, '').trim())
    .filter(Boolean)
  const roicRaw = m[2]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))

  if (datekeys.length === 0 || roicRaw.length === 0) return null

  const werte: Record<string, number> = {}
  const len = Math.min(datekeys.length, roicRaw.length)
  for (let i = 0; i < len; i++) {
    const key = datekeys[i] === 'TTM' ? FUNDAMENTAL_TTM_KEY : datekeys[i]!
    werte[key] = roicRaw[i]! * 100
  }
  return Object.keys(werte).length > 0 ? werte : null
}

function ratiosPfadAusHit(hit: SearchHit): string | null {
  const s = hit.s?.trim()
  if (!s) return null
  if (s.includes('/')) return `/quote/${s.toLowerCase()}/financials/ratios/`
  return `/stocks/${s.toLowerCase()}/financials/ratios/`
}

function waehleSearchHit(
  hits: SearchHit[],
  symbolYahoo: string | null,
  firmenname: string,
): SearchHit | null {
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

  const nameNorm = firmenname.trim().toLowerCase()
  if (nameNorm.length >= 4) {
    const byName = securities.find((h) => {
      const n = (h.n ?? '').toLowerCase()
      return n.includes(nameNorm.slice(0, 10)) || nameNorm.includes(n.slice(0, 10))
    })
    if (byName) return byName
  }

  return securities[0] ?? null
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

function kandidatenPfade(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  firmenname: string
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
    if (ex && base) add(`/quote/${ex}/${base}/financials/ratios/`)
  } else if (sym) {
    add(`/stocks/${sym.toLowerCase()}/financials/ratios/`)
  }

  const ticker = opts.ticker?.trim().toUpperCase()
  if (ticker && ticker !== sym) {
    add(`/stocks/${ticker.toLowerCase()}/financials/ratios/`)
  }

  const k = isinKenntnis(opts.isin?.trim().toUpperCase() ?? '')
  if (k?.symbolYahoo && k.symbolYahoo.toUpperCase() !== sym) {
    const ks = k.symbolYahoo.toUpperCase()
    if (ks.includes('.')) {
      const [base, suf] = ks.split('.')
      const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
      if (ex && base) add(`/quote/${ex}/${base}/financials/ratios/`)
    } else {
      add(`/stocks/${ks.toLowerCase()}/financials/ratios/`)
    }
  }

  return out
}

async function ladeRoicVonPfad(pfad: string): Promise<StockanalysisRoicDaten | null> {
  const html = await fetchHtml(pfad)
  if (!html) return null
  const werte = parseRoicAusHtml(html)
  if (!werte) return null
  return { werte, url: `${BASE}${pfad}` }
}

/**
 * ROIC-Zeitreihe von StockAnalysis (Macrotrends-Fallback).
 * US: /stocks/{ticker}/ — EU/international: /quote/{börse}/{ticker}/.
 */
export async function ladeStockanalysisRoic(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  firmenname: string
  isin?: string | null
}): Promise<StockanalysisRoicDaten | null> {
  const cacheKey = [
    opts.isin?.trim().toUpperCase() ?? '',
    opts.symbolYahoo?.trim().toUpperCase() ?? '',
    opts.ticker?.trim().toUpperCase() ?? '',
    opts.firmenname.trim(),
  ].join('|')

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.daten

  for (const pfad of kandidatenPfade(opts)) {
    const hit = await ladeRoicVonPfad(pfad)
    if (hit) {
      cache.set(cacheKey, { at: Date.now(), daten: hit })
      return hit
    }
  }

  const suchQueries = [
    opts.firmenname.trim(),
    opts.symbolYahoo?.split('.')[0]?.trim() ?? '',
    opts.ticker?.trim() ?? '',
  ].filter((q) => q.length >= 2)

  const seen = new Set<string>()
  for (const q of suchQueries) {
    const ql = q.toLowerCase()
    if (seen.has(ql)) continue
    seen.add(ql)

    const hits = await sucheStockanalysisHits(q)
    const hit = waehleSearchHit(hits, opts.symbolYahoo ?? null, opts.firmenname)
    const pfad = hit ? ratiosPfadAusHit(hit) : null
    if (!pfad || seen.has(pfad)) continue
    seen.add(pfad)

    const daten = await ladeRoicVonPfad(pfad)
    if (daten) {
      cache.set(cacheKey, { at: Date.now(), daten })
      return daten
    }
  }

  cache.set(cacheKey, { at: Date.now(), daten: null })
  return null
}

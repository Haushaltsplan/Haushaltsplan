/**
 * Marketscreener Detailed Income Statement — Chart-JSON (Gross Profit etc.).
 * Die Kurz-Seite /finances/ hat oft kein Gross Profit; /finances-income-statement/ schon.
 */

import 'server-only'

import {
  bekannterMarketscreenerSlug,
  marketscreenerSlugKandidaten,
} from '@/lib/portfolio-analyse/marketscreener-slug'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 700

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.marketscreener.com/',
}

export type MarketscreenerGuVChartReihe = {
  jahr: number
  wertUsd: number
}

export type MarketscreenerGuVChartPaket = {
  quelle: 'marketscreener'
  url: string
  bruttogewinnUsd: MarketscreenerGuVChartReihe[]
  ebitdaUsd: MarketscreenerGuVChartReihe[]
  ebitUsd: MarketscreenerGuVChartReihe[]
  nettogewinnUsd: MarketscreenerGuVChartReihe[]
}

const cache = new Map<string, { at: number; daten: MarketscreenerGuVChartPaket | null }>()
let letzterAbruf = 0

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const warten = Math.max(0, MIN_ABSTAND_MS - (Date.now() - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
}

/** Serie aus embedded financial-chart JSON (categories + data). */
function parseChartSerie(html: string, titelRe: RegExp): MarketscreenerGuVChartReihe[] {
  const out: MarketscreenerGuVChartReihe[] = []
  for (const m of html.matchAll(/data-fct-attr="([^"]+)"/gi)) {
    const raw = decodeHtmlEntities(m[1]!)
    if (!titelRe.test(raw)) continue
    const cats = raw.match(/"categories"\s*:\s*\[([^\]]+)\]/)?.[1]
    const data = raw.match(/"data"\s*:\s*\[([^\]]+)\]/)?.[1]
    if (!cats || !data) continue
    const jahre = cats
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => n > 2000)
    const werte = data.split(',').map((x) => {
      const t = x.trim()
      if (t === 'null' || t === '') return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    })
    for (let i = 0; i < jahre.length; i++) {
      const v = werte[i]
      if (v == null || Math.abs(v) < 1) continue
      out.push({ jahr: jahre[i]!, wertUsd: v })
    }
    if (out.length >= 2) break
  }
  return out
}

async function fetchMsHtml(url: string): Promise<string | null> {
  await throttle()
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(22_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    if (html.length < 8_000) return null
    if (/access denied|captcha|just a moment/i.test(html.slice(0, 4_000))) return null
    return html
  } catch {
    return null
  }
}

export async function ladeMarketscreenerGuVChartPaket(opts: {
  isin?: string | null
  firmenname?: string | null
  ticker?: string | null
  symbolYahoo?: string | null
  refresh?: boolean
}): Promise<MarketscreenerGuVChartPaket | null> {
  const isin = opts.isin?.trim().toUpperCase() ?? ''
  const cacheKey = `${isin}|${opts.ticker ?? ''}|${opts.firmenname ?? ''}`
  if (!opts.refresh) {
    const hit = cache.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.daten
  }

  const kandidaten: string[] = []
  const add = (s: string | null | undefined) => {
    const t = s?.trim()
    if (t && !kandidaten.includes(t)) kandidaten.push(t)
  }
  if (isin) add(bekannterMarketscreenerSlug(isin))
  for (const s of marketscreenerSlugKandidaten(isin, opts.firmenname ?? opts.ticker ?? '', opts.symbolYahoo)) {
    add(s)
  }

  let html: string | null = null
  let url = ''
  for (const slug of kandidaten.slice(0, 5)) {
    url = `${BASE}/${slug}/finances-income-statement/`
    html = await fetchMsHtml(url)
    if (html && /Gross Profit|EBITDA|Net income|Operating income/i.test(html)) break
    html = null
  }

  if (!html) {
    cache.set(cacheKey, { at: Date.now(), daten: null })
    return null
  }

  const paket: MarketscreenerGuVChartPaket = {
    quelle: 'marketscreener',
    url,
    bruttogewinnUsd: parseChartSerie(html, /Gross Profit/i),
    ebitdaUsd: parseChartSerie(html, /"serieName":"EBITDA"/i),
    ebitUsd: parseChartSerie(html, /"serieName":"(?:EBIT|Operating income|Operating profit)"/i),
    nettogewinnUsd: parseChartSerie(html, /"serieName":"(?:Net income|Net profit)"/i),
  }

  const hat =
    paket.bruttogewinnUsd.length >= 2 ||
    paket.ebitdaUsd.length >= 2 ||
    paket.ebitUsd.length >= 2 ||
    paket.nettogewinnUsd.length >= 2
  const out = hat ? paket : null
  cache.set(cacheKey, { at: Date.now(), daten: out })
  return out
}

/**
 * Incremental ROIC (ROIIC) — von GuruFocus (HTML-Scrape oder optional API).
 * Kein Free-Token nötig für Scrape; API nur wenn GURUFOCUS_API_KEY gesetzt.
 *
 * Env (optional): GURUFOCUS_API_KEY oder GURUFOCUS_API_TOKEN
 */

import 'server-only'

import { analyseTickerFuerPosition, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IncrementalRoicPaket } from '@/lib/portfolio-analyse/incremental-roic'

const CACHE_MS = 12 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: IncrementalRoicPaket }>()

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

function guruFocusToken(): string {
  return (
    process.env.GURUFOCUS_API_KEY?.trim() ||
    process.env.GURUFOCUS_API_TOKEN?.trim() ||
    ''
  )
}

/** GuruFocus-Sonderwerte: 9999 = N/A, 10000 = „Negative Equity“ o.ä. */
function parseGfRoiicPct(raw: unknown): number | null {
  if (raw == null || raw === '' || raw === '--') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[%,\s]/g, ''))
  if (!Number.isFinite(n) || n === 9999 || n === 10000 || n === -9999) return null
  if (Math.abs(n) > 500) return null
  return Math.round(n * 10) / 10
}

function fensterAusKey(key: string): 1 | 3 | 5 | null {
  const k = key.toLowerCase()
  if (/5/.test(k) && /roiic|incremental/.test(k)) return 5
  if (/3/.test(k) && /roiic|incremental/.test(k)) return 3
  if (/1/.test(k) && /roiic|incremental/.test(k)) return 1
  if (k === 'roiic_5y' || k === 'roiic-5y') return 5
  if (k === 'roiic_3y' || k === 'roiic-3y') return 3
  if (k === 'roiic_1y' || k === 'roiic-1y') return 1
  return null
}

function extrahiereRoiicAusJson(root: unknown): { y1: number | null; y3: number | null; y5: number | null } {
  const out = { y1: null as number | null, y3: null as number | null, y5: null as number | null }
  const walk = (node: unknown, depth = 0): void => {
    if (node == null || depth > 8) return
    if (Array.isArray(node)) {
      for (const x of node) walk(x, depth + 1)
      return
    }
    if (typeof node !== 'object') return
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      const fenster = fensterAusKey(key)
      if (fenster != null) {
        const pct = parseGfRoiicPct(val)
        if (pct != null) {
          if (fenster === 5 && out.y5 == null) out.y5 = pct
          if (fenster === 3 && out.y3 == null) out.y3 = pct
          if (fenster === 1 && out.y1 == null) out.y1 = pct
        }
      }
      if (val && typeof val === 'object') walk(val, depth + 1)
    }
  }
  walk(root)
  return out
}

function paketAusGuruFocus(roiic: { y1: number | null; y3: number | null; y5: number | null }): IncrementalRoicPaket {
  const incrementalRoic5yPct = roiic.y5
  const incrementalRoic1yPct = roiic.y1
  let incrementalRoicPct: number | null = null
  let fensterJahre: number | null = null
  if (roiic.y5 != null) {
    incrementalRoicPct = roiic.y5
    fensterJahre = 5
  } else if (roiic.y3 != null) {
    incrementalRoicPct = roiic.y3
    fensterJahre = 3
  } else if (roiic.y1 != null) {
    incrementalRoicPct = roiic.y1
    fensterJahre = 1
  }
  if (incrementalRoicPct == null) return leer()
  return {
    incrementalRoicPct,
    incrementalRoic1yPct,
    incrementalRoic5yPct,
    fensterJahre,
    quelle: 'gurufocus',
    methode: null,
  }
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseHtmlRoiicPct(html: string, fenster: 1 | 3 | 5): number | null {
  if (/Just a moment|cf-browser-verification|cloudflare/i.test(html)) return null
  const label =
    fenster === 5
      ? /5[\s-]*Year\s+ROIIC\s*%?[^0-9]{0,120}([\d.-]+)\s*%/i
      : fenster === 3
        ? /3[\s-]*Year\s+ROIIC\s*%?[^0-9]{0,120}([\d.-]+)\s*%/i
        : /1[\s-]*Year\s+ROIIC\s*%?[^0-9]{0,120}([\d.-]+)\s*%/i
  const m = html.match(label)
  if (!m) return null
  return parseGfRoiicPct(m[1])
}

async function scrapeGuruFocusTermPage(symbol: string, fenster: 1 | 3 | 5): Promise<number | null> {
  const sym = encodeURIComponent(symbol.trim().toUpperCase())
  const url = `https://www.gurufocus.com/term/roiic-${fenster}y/${sym}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.gurufocus.com/',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return parseHtmlRoiicPct(html, fenster)
  } catch {
    return null
  }
}

async function ladeGuruFocusRoiicScrape(symbol: string): Promise<{ y1: number | null; y3: number | null; y5: number | null }> {
  const [y5, y3, y1] = await Promise.all([
    scrapeGuruFocusTermPage(symbol, 5),
    scrapeGuruFocusTermPage(symbol, 3),
    scrapeGuruFocusTermPage(symbol, 1),
  ])
  return { y1, y3, y5 }
}

async function fetchGuruFocusJson(url: string, token: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: token,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function ladeGuruFocusRoiicRaw(symbol: string, token: string): Promise<unknown | null> {
  const sym = encodeURIComponent(symbol.trim().toUpperCase())
  const encToken = encodeURIComponent(token)
  const endpoints = [
    `https://api.gurufocus.com/public/user/${encToken}/stock/${sym}/keyratios`,
    `https://api.gurufocus.com/public/user/${encToken}/stock/${sym}/summary`,
    `https://api.gurufocus.com/data/stocks/${sym}/keyratios`,
    `https://api.gurufocus.com/data/stocks/${sym}/valuations`,
  ]
  for (const url of endpoints) {
    const j = await fetchGuruFocusJson(url, token)
    if (j != null) return j
  }
  return null
}

function usSymbolFuerGuruFocus(opts: {
  symbolYahoo: string
  ticker?: string | null
  isin?: string | null
}): string | null {
  const k = opts.isin ? isinKenntnis(opts.isin) : null
  const mt = k?.macrotrendsTicker?.trim().toUpperCase()
  if (mt && !mt.includes('.')) return mt
  const analyse = analyseTickerFuerPosition(opts.isin, opts.symbolYahoo)
  if (analyse && !analyse.includes('.')) return analyse.split('.')[0]!
  const sym = opts.symbolYahoo.trim().toUpperCase()
  const bare = sym.includes('.') ? sym.split('.')[0]! : sym
  if (/^[A-Z]{1,5}$/.test(bare)) return bare
  const t = opts.ticker?.trim().toUpperCase()
  if (t && !t.includes('.') && /^[A-Z]{1,5}$/.test(t)) return t
  return null
}

/** GuruFocus ROIIC — HTML-Scrape, optional API. */
export async function ladeIncrementalRoicVonGuruFocus(opts: {
  symbolYahoo: string
  ticker?: string | null
  isin?: string | null
}): Promise<IncrementalRoicPaket> {
  const sym = usSymbolFuerGuruFocus(opts)
  if (!sym) return leer()

  const cacheKey = `${sym}|${opts.isin ?? ''}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  let roiic = await ladeGuruFocusRoiicScrape(sym)

  const token = guruFocusToken()
  if (roiic.y5 == null && roiic.y3 == null && roiic.y1 == null && token) {
    const raw = await ladeGuruFocusRoiicRaw(sym, token)
    if (raw) roiic = extrahiereRoiicAusJson(raw)
  }

  const paket = paketAusGuruFocus(roiic)
  cache.set(cacheKey, { at: Date.now(), data: paket })
  return paket
}

export function guruFocusIncrementalRoicKonfiguriert(): boolean {
  return true
}

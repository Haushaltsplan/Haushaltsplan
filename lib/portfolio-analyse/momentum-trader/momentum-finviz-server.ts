/**
 * Finviz.com — Short Float & RSI (HTML-Scraper, kein API-Key).
 */

import 'server-only'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: MomentumFinvizKennzahlen | null }>()

export type MomentumFinvizKennzahlen = {
  symbol: string
  shortFloatPct: number | null
  shortRatio: number | null
  rsi14: number | null
  relVolume: number | null
  insiderOwnershipPct: number | null
  institutionalOwnershipPct: number | null
  peg: number | null
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html',
  Referer: 'https://finviz.com/',
} as const

function parseZahl(text: string): number | null {
  const m = text.replace(/,/g, '').match(/-?\d+\.?\d*/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function extrahiereSnapshotMap(html: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = /snapshot-td2[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*<b[^>]*>([^<]+)</gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    map.set(m[1].trim(), m[2].trim())
  }
  return map
}

/** Short Float, RSI, Rel Volume von Finviz (gecacht 6h). */
export async function ladeFinvizKennzahlen(
  symbol: string,
  opts?: { skipCache?: boolean },
): Promise<MomentumFinvizKennzahlen | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const hit = cache.get(sym)
  if (!opts?.skipCache && hit && Date.now() - hit.at < CACHE_MS) return hit.data

  try {
    const url = 'https://finviz.com/quote.ashx?t=' + encodeURIComponent(sym)
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      next: { revalidate: 21_600 },
    })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }
    const html = await res.text()
    const snap = extrahiereSnapshotMap(html)
    const data: MomentumFinvizKennzahlen = {
      symbol: sym,
      shortFloatPct: parseZahl(snap.get('Short Float') ?? ''),
      shortRatio: parseZahl(snap.get('Short Ratio') ?? ''),
      rsi14: parseZahl(snap.get('RSI (14)') ?? ''),
      relVolume: parseZahl(snap.get('Rel Volume') ?? ''),
      insiderOwnershipPct: parseZahl(snap.get('Insider Own') ?? ''),
      institutionalOwnershipPct: parseZahl(snap.get('Inst Own') ?? ''),
      peg: parseZahl(snap.get('PEG') ?? ''),
    }
    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}

/** Batch mit Pause — max. n Symbole (Rate-Limit). */
export async function ladeFinvizKennzahlenBatch(
  symbole: string[],
  max = 12,
): Promise<Map<string, MomentumFinvizKennzahlen>> {
  const out = new Map<string, MomentumFinvizKennzahlen>()
  const uniq = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, max)
  for (const sym of uniq) {
    const k = await ladeFinvizKennzahlen(sym)
    if (k) out.set(sym, k)
    await new Promise((r) => setTimeout(r, 800))
  }
  return out
}

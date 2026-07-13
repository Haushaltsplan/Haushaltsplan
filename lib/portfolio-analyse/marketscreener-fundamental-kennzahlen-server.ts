/** EU-Fundamentalkennzahlen — Marketscreener company / finances. */

import 'server-only'

import type { EuFundamentalPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { marketscreenerSlugKandidaten } from '@/lib/portfolio-analyse/marketscreener-slug'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 12 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: EuFundamentalPaket | null }>()

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
} as const

const WANT_PREFIX = [
  'P/E',
  'EV / Sales',
  'EV / EBITDA',
  'Net debt',
  'ROE',
  'ROA',
  'Dividend yield',
  'Yield',
  'Market Cap',
  'Enterprise Value',
  'Free-Float',
  '1-year Change',
]

function txt(html: string): string {
  return html
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseKennzahlenAusHtml(html: string): EuFundamentalPaket['kennzahlen'] {
  // Marketscreener 2026+: viele Kennzahlen stehen als <td label><th value> in einer Tabelle,
  // oft mit Jahres-Suffixen ("EV / Sales 2026 *"). Wir sammeln daher alle Paare und filtern nach Prefix.
  const pairs: Array<{ label: string; wert: string }> = []
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  for (const r of rows) {
    const row = r[1] ?? ''
    for (const m of row.matchAll(
      /<td[^>]*table-child--nowrap[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<t[hd][^>]*table-child--right[^>]*>\s*([\s\S]*?)\s*<\/t[hd]>/gi,
    )) {
      const label = txt(m[1] ?? '')
      const wert = txt(m[2] ?? '')
      if (!label || !wert || wert === '-' || wert === '—') continue
      pairs.push({ label, wert })
    }
  }

  const out: EuFundamentalPaket['kennzahlen'] = []
  const seen = new Set<string>()
  const want = WANT_PREFIX.map((p) => p.toLowerCase())

  for (const { label, wert } of pairs) {
    const l = label.toLowerCase()
    const prefIdx = want.findIndex((p) => l.startsWith(p.toLowerCase()))
    if (prefIdx < 0) continue
    const key = label
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label, wert })
    if (out.length >= 14) break
  }

  return out
}

export async function ladeEuFundamentalKennzahlen(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<EuFundamentalPaket | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10) return null

  const hit = cache.get(isinNorm)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  for (const slug of marketscreenerSlugKandidaten(isinNorm, name, symbolYahoo)) {
    for (const path of [`${BASE}/${slug}/company/`, `${BASE}/${slug}/`]) {
      try {
        const res = await fetch(path, { headers: FETCH_HEADERS, cache: 'no-store' })
        if (!res.ok) continue
        const html = await res.text()
        if (html.length < 20_000) continue
        const kennzahlen = parseKennzahlenAusHtml(html)
        if (kennzahlen.length < 3) continue
        const data: EuFundamentalPaket = { kennzahlen, quelle: 'marketscreener' }
        cache.set(isinNorm, { at: Date.now(), data })
        return data
      } catch {
        continue
      }
    }
  }

  cache.set(isinNorm, { at: Date.now(), data: null })
  return null
}

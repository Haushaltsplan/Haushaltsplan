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

const LABELS = [
  'P/E ratio',
  'EV / Sales',
  'EV / EBITDA',
  'Net debt',
  'ROE',
  'ROA',
  'Dividend yield',
  'Capitalization',
  'Free-Float',
  '1-year Change',
]

function parseKennzahlenAusHtml(html: string): EuFundamentalPaket['kennzahlen'] {
  const out: EuFundamentalPaket['kennzahlen'] = []
  for (const label of LABELS) {
    const re = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,120}?<(?:td|span)[^>]*>\\s*([^<]{1,40})\\s*<',
      'i',
    )
    const m = html.match(re)
    if (m?.[1]) {
      const wert = m[1].replace(/\s+/g, ' ').trim()
      if (wert && wert !== '-' && wert !== '—') out.push({ label, wert })
    }
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

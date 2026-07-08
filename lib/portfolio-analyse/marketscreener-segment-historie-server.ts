/** Marketscreener — Umsatzmix nach Segment & Region (finances-segments). */

import 'server-only'

import type { SecSegmentHistoriePaket, SecZusatzRisikoFelder } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { isinKenntnis, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  extrahiereMsSegmentHistorien,
  htmlHatMsSegmentDaten,
} from '@/lib/portfolio-analyse/marketscreener-segment-parser'
import {
  bekannterMarketscreenerSlug,
  marketscreenerSlugKandidaten,
} from '@/lib/portfolio-analyse/marketscreener-slug'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 12 * 60 * 60 * 1000
const CACHE_VERSION = 8
const MAX_ZUSAETZLICHE_SLUGS = 4
const MIN_ABSTAND_MS = 300
const NULL_CACHE_MS = 5 * 60 * 1000

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.marketscreener.com/',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
}

const cache = new Map<string, { at: number; v: number; data: SecSegmentHistoriePaket | null }>()
let letzterAbruf = 0

const LEER_ZUSATZ: SecZusatzRisikoFelder = {
  mitarbeiterAnzahl: null,
  auslandsumsatzAnteilPct: null,
  hauptkunden: [],
  mitarbeiterHistorie: [],
  kundenKonzentrationHistorie: [],
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const warten = Math.max(0, MIN_ABSTAND_MS - (Date.now() - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()
}

function normalisiereName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

async function fetchMsHtml(url: string, retries = 1): Promise<string | null> {
  await throttle()
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length > 5_000 && !/access denied|captcha|bot detection/i.test(html.slice(0, 4_000))) {
        return html
      }
    } catch {
      /* retry */
    }
    if (attempt < retries) await pause(500)
  }
  return null
}

async function fetchSegmentsHtml(slug: string): Promise<string | null> {
  return fetchMsHtml(`${BASE}/${slug}/finances-segments/`)
}

function slugsAusIsinSucheHtml(html: string, name: string): string[] {
  const alleSlugs = [...html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1]!)
  const kern = normalisiereName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['INC', 'PLC', 'AG', 'THE', 'AND', 'HOLDING', 'GROUP'].includes(w))
  const haupt = kern.slice(0, 2).join(' ')
  const out: string[] = []
  for (const slug of alleSlugs) {
    const slugText = normalisiereName(slug.replace(/-/g, ' '))
    if (haupt && haupt.split(' ').every((w) => slugText.includes(w))) {
      out.push(slug)
    }
  }
  for (const m of html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\/"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = normalisiereName(m[2].replace(/<[^>]+>/g, ' '))
    if (haupt && haupt.split(' ').every((w) => text.includes(w))) {
      out.push(m[1]!)
    }
  }
  return [...new Set(out.length > 0 ? out : alleSlugs.slice(0, 6))]
}

async function slugsAusNameSuche(name: string): Promise<string[]> {
  const q = name.trim()
  if (q.length < 3) return []
  await throttle()
  try {
    const res = await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(q)}`, {
      headers: FETCH_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return []
    return slugsAusIsinSucheHtml(await res.text(), name)
  } catch {
    return []
  }
}

async function slugsAusIsinSuche(isin: string, name: string): Promise<string[]> {
  await throttle()
  try {
    const res = await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(isin)}`, {
      headers: FETCH_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return slugsAusIsinSucheHtml(html, name)
  } catch {
    return []
  }
}

async function versucheSlug(slug: string): Promise<{ slug: string; html: string } | null> {
  const html = await fetchSegmentsHtml(slug)
  if (!html) return null
  if (!htmlHatMsSegmentDaten(html)) {
    if (!html.includes('financialSegmentCA')) return null
    const { produkt, geo } = extrahiereMsSegmentHistorien(html)
    if (!produkt && !geo) return null
  }
  return { slug, html }
}

async function findeGueltigenSlug(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<{ slug: string; html: string } | null> {
  const hart = isin.length >= 10 ? bekannterMarketscreenerSlug(isin) : null
  if (hart) {
    const treffer = await versucheSlug(hart)
    if (treffer) return treffer
  }

  const ausIsinSuche = isin.length >= 10 ? await slugsAusIsinSuche(isin, name) : []
  let versuche = 0
  for (const slug of ausIsinSuche) {
    if (slug === hart) continue
    if (hart && versuche >= MAX_ZUSAETZLICHE_SLUGS) break
    versuche++
    const treffer = await versucheSlug(slug)
    if (treffer) return treffer
  }

  const ausNameSuche = ausIsinSuche.length === 0 ? await slugsAusNameSuche(name) : []
  for (const slug of ausNameSuche) {
    if (slug === hart || ausIsinSuche.includes(slug)) continue
    if (hart && versuche >= MAX_ZUSAETZLICHE_SLUGS) break
    versuche++
    const treffer = await versucheSlug(slug)
    if (treffer) return treffer
  }

  const generiert = [
    ...new Set(
      marketscreenerSlugKandidaten(isin, name, symbolYahoo).flatMap((s) => [
        s,
        s.replace(/-CORP-/, '-CORPORATION-'),
        s.replace(/-INC-/, '-INCORPORATION-'),
      ]),
    ),
  ].filter((s) => s !== hart && !ausIsinSuche.includes(s) && !ausNameSuche.includes(s))

  for (const slug of generiert) {
    if (hart && versuche >= MAX_ZUSAETZLICHE_SLUGS) break
    versuche++
    const treffer = await versucheSlug(slug)
    if (treffer) return treffer
  }

  return null
}

function segmentCacheKey(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
}): string {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })
  if (isin && isin.length >= 10) return isin
  return [opts.isin, opts.symbolYahoo, opts.ticker, opts.name]
    .map((s) => s?.trim().toUpperCase() ?? '')
    .filter(Boolean)
    .join('|')
}

function bauePaketAusHtml(html: string): SecSegmentHistoriePaket | null {
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  if (!produkt && !geo) return null

  const berichtJahr = Math.max(produkt?.juengstesJahr ?? 0, geo?.juengstesJahr ?? 0)
  const auslandAnteil =
    geo?.jahre.length && geo.jahre[geo.jahre.length - 1]
      ? (() => {
          const seg = geo.jahre[geo.jahre.length - 1]!.segmente
          const intl = seg.find((s) =>
            /non.?us|other countr|international|rest of|europe|asia|emea|abroad|foreign|apac/i.test(s.name),
          )
          return intl?.anteilPct ?? null
        })()
      : null

  return {
    produkt,
    geo,
    kategorien: [],
    zusatz: { ...LEER_ZUSATZ, auslandsumsatzAnteilPct: auslandAnteil },
    backlog: null,
    kennzahlen: null,
    berichtJahr: berichtJahr > 0 ? berichtJahr : null,
    anzahl10k: Math.max(produkt?.anzahlJahre ?? 0, geo?.anzahlJahre ?? 0),
    geladenAm: new Date().toISOString(),
    quelle: 'marketscreener',
  }
}

export async function ladeMarketscreenerSegmentHistorie(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
}): Promise<SecSegmentHistoriePaket | null> {
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    symbolYahoo: opts.symbolYahoo,
    ticker: opts.ticker,
    firmenname: opts.name,
  })

  if (!isin && !opts.name?.trim() && !opts.symbolYahoo?.trim() && !opts.ticker?.trim()) return null

  const cacheKey = segmentCacheKey(opts)
  const hit = cache.get(cacheKey)
  if (hit && hit.v === CACHE_VERSION) {
    const maxAge = hit.data ? CACHE_MS : NULL_CACHE_MS
    if (Date.now() - hit.at < maxAge) return hit.data
  }

  try {
    const symbol = opts.symbolYahoo?.trim() || opts.ticker?.trim() || (isin ? isinKenntnis(isin)?.symbolYahoo : undefined)
    const isinFuerSlug = isin ?? opts.isin?.trim().toUpperCase() ?? ''
    const treffer = await findeGueltigenSlug(isinFuerSlug, opts.name, symbol)
    if (!treffer) {
      console.warn(
        `[marketscreener-segments] Kein Treffer für ${isinFuerSlug || opts.name} (${opts.symbolYahoo ?? opts.ticker ?? '?'})`,
      )
      cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: null })
      return null
    }

    const paket = bauePaketAusHtml(treffer.html)
    if (!paket) {
      cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: null })
      return null
    }

    cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: paket })
    return paket
  } catch (e) {
    console.warn(`[marketscreener-segments] Fehler für ${cacheKey}:`, e)
    cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: null })
    return null
  }
}

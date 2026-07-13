/** Live-Fundamentaldaten von Marketscreener (Watchlist-Fallback). */

import 'server-only'

import type {
  FundamentalKeyMetric,
  FundamentalMetrikZeile,
  FundamentalPeriode,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { baueMantraAudit } from '@/lib/portfolio-analyse/fundamentaldaten-mantra'
import {
  bekannterMarketscreenerSlug,
  marketscreenerSlugKandidaten,
} from '@/lib/portfolio-analyse/marketscreener-slug'
import { parseKennzahlenAusHtml } from '@/lib/portfolio-analyse/marketscreener-fundamental-kennzahlen-server'

const BASE = 'https://www.marketscreener.com/quote/stock'
const MIN_ABSTAND_MS = 700

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.marketscreener.com/',
}

let letzterAbruf = 0
let msCookieHeader = ''
let msCookieAt = 0

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

const SLUG_STOPWORDS = new Set(['INC', 'CORP', 'CORPORATION', 'PLC', 'AG', 'GROUP', 'HOLDING', 'THE', 'AND', 'SA'])

async function ensureMsCookies(force = false): Promise<string> {
  if (!force && msCookieHeader && Date.now() - msCookieAt < 30 * 60 * 1000) return msCookieHeader
  msCookieHeader = ''
  try {
    const res = await fetch('https://www.marketscreener.com/', {
      headers: FETCH_HEADERS,
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    const setCookies = res.headers.getSetCookie?.() ?? []
    msCookieHeader = setCookies.map((c) => c.split(';')[0]!).filter(Boolean).join('; ')
    msCookieAt = Date.now()
  } catch {
    msCookieHeader = ''
  }
  return msCookieHeader
}

function htmlBlockiert(html: string): boolean {
  if (html.length < 5_000) return true
  const kopf = html.slice(0, 8_000).toLowerCase()
  return /access denied|captcha|bot detection|cf-challenge|just a moment/.test(kopf)
}

async function fetchMsHtml(url: string, retries = 3): Promise<string | null> {
  await throttle()
  let cookie = await ensureMsCookies()
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = { ...FETCH_HEADERS }
      if (cookie) headers.Cookie = cookie
      const res = await fetch(url, {
        headers,
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(35_000),
      })
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) cookie = await ensureMsCookies(true)
        continue
      }
      const html = await res.text()
      if (!htmlBlockiert(html)) return html
      cookie = await ensureMsCookies(true)
    } catch {
      /* retry */
    }
    if (attempt < retries) await pause(600 + attempt * 400)
  }
  return null
}

function slugsAusSucheHtml(html: string, name: string): string[] {
  const alleSlugs = [...html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1]!)
  const kern = normalisiereName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SLUG_STOPWORDS.has(w))
  const haupt = kern.slice(0, 2).join(' ')
  const out: string[] = []
  for (const slug of alleSlugs) {
    const slugText = normalisiereName(slug.replace(/-/g, ' '))
    if (haupt && haupt.split(' ').every((w) => slugText.includes(w))) out.push(slug)
  }
  for (const m of html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\/"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = normalisiereName(m[2].replace(/<[^>]+>/g, ' '))
    if (haupt && haupt.split(' ').every((w) => text.includes(w))) out.push(m[1]!)
  }
  return [...new Set(out.length > 0 ? out : alleSlugs.slice(0, 6))]
}

async function slugsAusIsinSuche(isin: string, name: string): Promise<string[]> {
  const html = await fetchMsHtml(`https://www.marketscreener.com/search/?q=${encodeURIComponent(isin)}`)
  return html ? slugsAusSucheHtml(html, name) : []
}

async function slugsAusNameSuche(name: string): Promise<string[]> {
  const q = name.trim()
  if (q.length < 3) return []
  const html = await fetchMsHtml(`https://www.marketscreener.com/search/?q=${encodeURIComponent(q)}`)
  return html ? slugsAusSucheHtml(html, name) : []
}

function htmlPasstZuUnternehmen(html: string, name: string): boolean {
  const titleRaw = html.match(/<title>([^<]+)/)?.[1] ?? ''
  const title = normalisiereName(titleRaw).toLowerCase()
  const parts = normalisiereName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SLUG_STOPWORDS.has(w))
  const kern = parts.slice(0, 2)
  if (kern.length < 1) return true
  return kern.every((w) => title.includes(w.toLowerCase()))
}

async function findeMarketscreenerSlug(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
}): Promise<string | null> {
  const isin = opts.isin?.trim().toUpperCase() ?? ''
  const name = opts.name.trim()
  if (!name && isin.length < 10) return null

  const hart = isin.length >= 10 ? bekannterMarketscreenerSlug(isin) : null
  if (hart) {
    const html = await fetchMsHtml(`${BASE}/${hart}/`)
    if (html && htmlPasstZuUnternehmen(html, name || hart)) return hart
  }

  const ausIsin = isin.length >= 10 ? await slugsAusIsinSuche(isin, name) : []
  for (const slug of ausIsin) {
    const html = await fetchMsHtml(`${BASE}/${slug}/`)
    if (html && htmlPasstZuUnternehmen(html, name)) return slug
  }

  const ausName = ausIsin.length === 0 && name.length >= 3 ? await slugsAusNameSuche(name) : []
  for (const slug of ausName) {
    if (ausIsin.includes(slug)) continue
    const html = await fetchMsHtml(`${BASE}/${slug}/`)
    if (html && htmlPasstZuUnternehmen(html, name)) return slug
  }

  for (const slug of marketscreenerSlugKandidaten(isin, name, opts.symbolYahoo)) {
    if (ausIsin.includes(slug) || ausName.includes(slug) || slug === hart) continue
    const html = await fetchMsHtml(`${BASE}/${slug}/`)
    if (html && htmlPasstZuUnternehmen(html, name)) return slug
  }

  return null
}

function zellenLabel(tdHtml: string): string {
  return tdHtml
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMioZelleHtml(cellHtml: string): number | null {
  const title = cellHtml.match(/title="([^"]+)"/)?.[1]
  const txt = cellHtml.replace(/<[^>]+>/g, '').replace(/,/g, '').trim()
  const raw = title?.replace(/,/g, '') ?? txt
  if (!raw || raw === '-' || raw === '—') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function metrikFuerLabel(label: string): { id: string; label: string; gruppe: FundamentalMetrikZeile['gruppe'] } | null {
  const l = label.trim()
  if (/^Net sales/i.test(l)) return { id: 'umsatz', label: 'Umsatz', gruppe: 'finanzdaten' }
  if (/^EBITDA/i.test(l)) return { id: 'ebitda', label: 'EBITDA', gruppe: 'finanzdaten' }
  if (/^EBIT$/i.test(l)) return { id: 'ebit', label: 'EBIT', gruppe: 'finanzdaten' }
  if (/^Net income/i.test(l)) return { id: 'nettogewinn', label: 'Nettogewinn', gruppe: 'finanzdaten' }
  if (/^Operating income/i.test(l)) return { id: 'operating_income', label: 'Operating Income', gruppe: 'finanzdaten' }
  if (/^Gross profit/i.test(l)) return { id: 'bruttogewinn', label: 'Bruttogewinn', gruppe: 'finanzdaten' }
  if (/^Free cash flow/i.test(l)) return { id: 'fcf', label: 'Free Cash Flow', gruppe: 'cashflow' }
  return null
}

function parseGuVAusFinancesHtml(html: string): {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
} {
  const idx = html.indexOf('income-statement-annual')
  if (idx < 0) return { perioden: [], zeilen: [] }

  const block = html.slice(idx, idx + 320_000)
  const table = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)].find((t) => /Net sales/i.test(t[0]))?.[0]
  if (!table) return { perioden: [], zeilen: [] }

  const spalten: { jahr: number; istSchaetzung: boolean }[] = []
  for (const m of table.matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/gi)) {
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const ym = /^(\d{4})/.exec(label)
    if (!ym) continue
    spalten.push({
      jahr: Number(ym[1]),
      istSchaetzung: /estimate|italic|muted/i.test(m[1]),
    })
  }
  if (spalten.length === 0) return { perioden: [], zeilen: [] }

  const perioden: FundamentalPeriode[] = spalten.map((s) => ({
    iso: `${s.jahr}-12-31`,
    label: String(s.jahr) + (s.istSchaetzung ? 'e' : ''),
    istSchaetzung: s.istSchaetzung,
  }))

  const zeilenMap = new Map<string, FundamentalMetrikZeile>()

  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    if (tds.length < 2) continue
    const rowLabel = zellenLabel(tds[0]![1])
    const metrik = metrikFuerLabel(rowLabel)
    if (!metrik) continue

    const werte: Record<string, number | null> = {}
    for (let i = 0; i < spalten.length; i++) {
      const td = tds[i + 1]
      if (!td) continue
      werte[`${spalten[i]!.jahr}-12-31`] = parseMioZelleHtml(td[1]!)
    }

    zeilenMap.set(metrik.id, {
      id: metrik.id,
      label: metrik.label,
      gruppe: metrik.gruppe,
      einheit: 'waehrung_usd_mio',
      werte,
    })
  }

  return { perioden, zeilen: [...zeilenMap.values()] }
}

function keyMetricsAusKennzahlen(kennzahlen: { label: string; wert: string }[]): FundamentalKeyMetric[] {
  return kennzahlen.map((k) => {
    const id = k.label
      .toLowerCase()
      .replace(/\d{4}.*/, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28)
    const gruppe = /p\/e|ev|yield|market cap|enterprise value/i.test(k.label)
      ? ('bewertung_ltm' as const)
      : ('marktdaten' as const)
    return { id: `ms_${id}`, label: k.label, wert: k.wert, gruppe }
  })
}

function firmennameAusHtml(html: string, fallback: string): string {
  const m = html.match(/<title>([^<|:]+)/)?.[1]?.trim()
  return m && m.length > 2 ? m : fallback
}

function tickerAusSlug(slug: string): string {
  const parts = slug.split('-')
  const numIdx = parts.findIndex((p) => /^\d+$/.test(p))
  if (numIdx > 0) return parts.slice(0, numIdx).join('-')
  return slug
}

/** Live-Scrape: Kennzahlen + GuV von Marketscreener (ISIN/Name-Suche). */
export async function ladeMarketscreenerWatchlistPaket(opts: {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
}): Promise<FundamentaldatenPaket | null> {
  const name = opts.name?.trim() || 'Unbekannt'
  const slug = await findeMarketscreenerSlug(opts)
  if (!slug) return null

  const [quoteHtml, financesHtml] = await Promise.all([
    fetchMsHtml(`${BASE}/${slug}/`),
    fetchMsHtml(`${BASE}/${slug}/finances/`),
  ])

  const kennzahlen = quoteHtml ? parseKennzahlenAusHtml(quoteHtml) : []
  const guv = financesHtml ? parseGuVAusFinancesHtml(financesHtml) : { perioden: [], zeilen: [] }
  if (kennzahlen.length < 3 && guv.zeilen.length === 0) return null

  const firmenname = quoteHtml ? firmennameAusHtml(quoteHtml, name) : name
  const ticker = tickerAusSlug(slug)

  return {
    ok: true,
    quelle: 'marketscreener',
    ticker,
    slug,
    firmenname,
    branche: null,
    sektor: null,
    website: null,
    beschreibung: null,
    waehrung: 'USD',
    perioden: guv.perioden,
    zeilen: guv.zeilen,
    keyMetrics: keyMetricsAusKennzahlen(kennzahlen),
    mantra: baueMantraAudit(
      null,
      null,
      null,
      guv.zeilen.length ? guv : { perioden: [], zeilen: [] },
      { perioden: [], zeilen: [] },
    ),
    mantraMeta: null,
    news: [],
    symbolYahoo: opts.symbolYahoo ?? null,
    geladenAm: new Date().toISOString(),
    frequenz: 'jahr',
    fehler: null,
    erweitert: null,
  }
}

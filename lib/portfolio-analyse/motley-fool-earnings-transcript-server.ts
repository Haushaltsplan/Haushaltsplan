/** Motley Fool — kostenlose Earnings-Call-Transkripte (US & große internationale Titel). */

import 'server-only'

import { isoInJahren, isoVorJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  istEarningsCallTranskript,
  istPresseMitteilung,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import { htmlZuFliesstext } from '@/lib/html/text-aus-html'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

export type FoolTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

const FOOL_ORIGIN = 'https://www.fool.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const ARCHIVE_PAGE_DELAY_MS = 200
const ARTICLE_DELAY_MS = 120
const FETCH_TIMEOUT_MS = 12_000
const DISCOVERY_BUDGET_MS = 50_000
const MAX_ARCHIVE_PAGES = 12
const MAX_URL_KANDIDATEN = 10
const MAX_QUARTALS_RASTER = 4

/** Bekannte Slug-Präfixe, falls Firmenname fehlt oder abweicht. */
const BEKANNTE_FOOL_SLUGS: Record<string, string[]> = {
  AAPL: ['apple'],
  ABBV: ['abbvie'],
  ABT: ['abbott'],
  ADBE: ['adobe'],
  AMGN: ['amgen'],
  AMZN: ['amazon'],
  AVGO: ['broadcom'],
  BAC: ['bank-of-america'],
  BRK: ['berkshire-hathaway'],
  'BRK.B': ['berkshire-hathaway'],
  COST: ['costco'],
  CRM: ['salesforce'],
  CSCO: ['cisco'],
  CVX: ['chevron'],
  DIS: ['walt-disney', 'disney'],
  GOOG: ['alphabet'],
  GOOGL: ['alphabet'],
  HD: ['home-depot'],
  INTC: ['intel'],
  JNJ: ['johnson-johnson'],
  JPM: ['jpmorgan', 'jp-morgan'],
  KO: ['coca-cola'],
  LLY: ['eli-lilly', 'lilly'],
  MA: ['mastercard'],
  META: ['meta-platforms', 'meta'],
  MRK: ['merck'],
  MSFT: ['microsoft'],
  NFLX: ['netflix'],
  NVDA: ['nvidia'],
  ORCL: ['oracle'],
  PEP: ['pepsico'],
  PFE: ['pfizer'],
  PG: ['procter-gamble'],
  TMO: ['thermo-fisher'],
  TSLA: ['tesla'],
  UNH: ['unitedhealth', 'unitedhealth-group', 'united-health'],
  V: ['visa'],
  WMT: ['walmart'],
  XOM: ['exxon', 'exxon-mobil'],
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalisiereFoolTicker(ticker: string): string[] {
  const t = ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  if (!t) return []
  const variants = [t]
  if (t.includes('.')) variants.push(t.split('.')[0])
  if (t === 'GOOG') variants.push('GOOGL')
  if (t === 'GOOGL') variants.push('GOOG')
  return [...new Set(variants.filter(Boolean))]
}

function firmennameZuSlug(name: string): string[] {
  const cleaned = name
    .replace(/\b(inc\.?|corp\.?|corporation|ltd\.?|limited|llc|plc|ag|se|sa|nv|n\.v\.|co\.?|group|holding[s]?)\b/gi, ' ')
    .trim()
  const base = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const out = new Set<string>()
  if (base) out.add(base)
  const first = base.split('-').filter(Boolean)[0]
  if (first) out.add(first)
  return [...out]
}

function slugPasstZuTicker(slug: string, tickers: string[]): boolean {
  const s = slug.toLowerCase()
  return tickers.some((t) => {
    const tl = t.toLowerCase().replace(/\./g, '-')
    return (
      s.includes(`-${tl}-q`) ||
      s.includes(`-${tl}-`) ||
      s.endsWith(`-${tl}`) ||
      new RegExp(`-${tl}-earnings`, 'i').test(s)
    )
  })
}

/** Typische Earnings-Call-Monate je Quartal (US-Konvention). */
function callMonatFuerQuartal(quartal: number, jahr: number): { jahr: number; monat: number } {
  switch (quartal) {
    case 1:
      return { jahr, monat: 4 }
    case 2:
      return { jahr, monat: 7 }
    case 3:
      return { jahr, monat: 10 }
    default:
      return { jahr: jahr + 1, monat: 1 }
  }
}

function letzteBerichtsQuartale(max: number): Array<{ quartal: number; jahr: number }> {
  const now = new Date()
  let jahr = now.getUTCFullYear()
  let quartal = Math.ceil((now.getUTCMonth() + 1) / 3)
  const out: Array<{ quartal: number; jahr: number }> = []
  for (let i = 0; i < max; i++) {
    out.push({ quartal, jahr })
    quartal--
    if (quartal === 0) {
      quartal = 4
      jahr--
    }
  }
  return out
}

function datumPfadeMonat(jahr: number, monat: number): string[] {
  const out: string[] = []
  for (let day = 8; day <= 31; day++) {
    out.push(`${jahr}/${String(monat).padStart(2, '0')}/${String(day).padStart(2, '0')}`)
  }
  const prev = monat === 1 ? { jahr: jahr - 1, monat: 12 } : { jahr, monat: monat - 1 }
  for (let day = 25; day <= 31; day++) {
    out.push(`${prev.jahr}/${String(prev.monat).padStart(2, '0')}/${String(day).padStart(2, '0')}`)
  }
  return [...new Set(out)]
}

function datumAusFoolUrl(url: string): string | null {
  const m = url.match(/\/earnings\/call-transcripts\/(\d{4})\/(\d{2})\/(\d{2})\//)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function extrahiereArchiveLinks(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/\/earnings\/call-transcripts\/20\d{2}\/\d{2}\/\d{2}\/[^"'\s\\]+/g)].map((m) => m[0]),
    ),
  ]
}

function titelAusSlug(slug: string): string {
  return slug
    .replace(/-earnings-call-transcript$/i, '')
    .replace(/-earnings-transcript$/i, '')
    .replace(/-/g, ' ')
    .replace(/\bq([1-4])\b/i, 'Q$1')
}

async function foolFetch(url: string): Promise<{ ok: boolean; html: string; status: number }> {
  const abs = url.startsWith('http') ? url : `${FOOL_ORIGIN}${url}`
  try {
    const res = await fetch(abs, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return { ok: res.ok, html: await res.text(), status: res.status }
  } catch {
    return { ok: false, html: '', status: 0 }
  }
}

async function foolUrlExistiert(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    if (head.ok) return true
    if (head.status === 404 || head.status === 410) return false
  } catch {
    /* GET-Fallback */
  }
  const { ok, status, html } = await foolFetch(url)
  if (!ok || status === 404) return false
  return html.length > 500
}

function slugVarianten(firmSlug: string, ticker: string, quartal?: number, jahr?: number): string[] {
  const t = ticker.toLowerCase()
  const out = new Set<string>()
  const suffixes = ['-earnings-transcript', '-earnings-call-transcript', '-earnings-call-trans']

  const addBase = (base: string) => {
    for (const s of suffixes) out.add(base + s)
  }

  if (quartal != null && jahr != null) {
    addBase(`${firmSlug}-${t}-q${quartal}-${jahr}`)
    if (firmSlug.includes('unitedhealth')) {
      addBase(`unitedhealth-group-${t}-q${quartal}-${jahr}`)
    }
  }

  addBase(`${firmSlug}-${t}`)
  if (firmSlug.includes('unitedhealth')) {
    addBase(`unitedhealth-group-${t}`)
  }

  return [...out]
}

function datumPfade(isoDate: string): string[] {
  const basis = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(basis.getTime())) return []
  const out: string[] = []
  for (let delta = -4; delta <= 4; delta++) {
    const d = new Date(basis)
    d.setUTCDate(d.getUTCDate() + delta)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    out.push(`${y}/${m}/${day}`)
  }
  return [...new Set(out)]
}

function firmSlugsFuerTicker(ticker: string, firmenname: string | null): string[] {
  const tickers = normalisiereFoolTicker(ticker)
  const slugs = new Set<string>()
  for (const t of tickers) {
    for (const s of BEKANNTE_FOOL_SLUGS[t] ?? []) slugs.add(s)
  }
  if (firmenname?.trim()) {
    for (const s of firmennameZuSlug(firmenname)) slugs.add(s)
  }
  return [...slugs]
}

async function kandidatenViaBing(ticker: string, firmenname: string | null): Promise<string[]> {
  const queries = suchQueriesFuerTicker(ticker, firmenname)
  const urls: string[] = []
  for (const q of queries) {
    try {
      const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const html = await res.text()
      urls.push(
        ...[...html.matchAll(/https:\/\/www\.fool\.com\/earnings\/call-transcripts\/[^"&]+/g)]
          .map((m) => m[0].replace(/&amp;/g, '&').split('&')[0])
          .filter((u) => u.includes('/earnings/call-transcripts/')),
      )
    } catch {
      continue
    }
  }
  return [...new Set(urls)]
}

function suchQueriesFuerTicker(ticker: string, firmenname: string | null): string[] {
  const t = ticker.trim().toUpperCase()
  const name = firmenname?.trim()
  const out = [
    `site:fool.com/earnings/call-transcripts ${t}`,
    `site:fool.com/earnings/call-transcripts ${name ?? t}`,
    `site:fool.com ${name ?? t} earnings call transcript`,
  ]
  if (name && name.toLowerCase() !== t.toLowerCase()) {
    out.push(`site:fool.com ${name} ${t} transcript`)
  }
  return [...new Set(out.filter(Boolean))]
}

type YahooHistoryRow = {
  quarter?: { raw?: number }
  period?: string
}

async function kandidatenViaYahoo(
  tickers: string[],
  firmSlugs: string[],
): Promise<string[]> {
  if (firmSlugs.length === 0 || tickers.length === 0) return []

  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const sym = tickers[0]
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'earningsHistory')
  u.searchParams.set('crumb', auth.crumb)

  let history: YahooHistoryRow[] = []
  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) return []
    history =
      (await res.json()).quoteSummary?.result?.[0]?.earningsHistory?.history ?? []
  } catch {
    return []
  }

  const urls: string[] = []
  for (const row of history.slice(0, 12)) {
    const quartal = row.quarter?.raw
    const period = row.period?.trim()
    if (quartal == null || quartal < 1 || quartal > 4 || !period) continue

    const end = new Date(`${period}T12:00:00Z`)
    if (Number.isNaN(end.getTime())) continue

    const callEst = new Date(end)
    callEst.setUTCDate(callEst.getUTCDate() + 30)
    const callIso = callEst.toISOString().slice(0, 10)

    const basisJahr = end.getUTCFullYear()
    const jahre = [basisJahr, basisJahr + 1, basisJahr - 1]

    for (const firmSlug of firmSlugs) {
      for (const jahr of jahre) {
        for (const slug of slugVarianten(firmSlug, sym, quartal, jahr)) {
          for (const pfad of datumPfade(callIso)) {
            urls.push(`${FOOL_ORIGIN}/earnings/call-transcripts/${pfad}/${slug}/`)
          }
        }
      }
    }
  }

  return [...new Set(urls)]
}

async function kandidatenViaFinnhubKalender(
  ticker: string,
  firmSlugs: string[],
  tickers: string[],
): Promise<string[]> {
  const key = (process.env.FINNHUB_API_KEY ?? '').trim()
  if (!key || firmSlugs.length === 0) return []

  const u = new URL('https://finnhub.io/api/v1/calendar/earnings')
  u.searchParams.set('from', isoVorJahren(2))
  u.searchParams.set('to', isoInJahren(1))
  u.searchParams.set('symbol', tickers[0])
  u.searchParams.set('token', key)

  let rows: Array<{ date?: string; quarter?: number; year?: number }> = []
  try {
    const res = await fetch(u.toString(), { cache: 'no-store' })
    if (!res.ok) return []
    rows = (await res.json()).earningsCalendar ?? []
  } catch {
    return []
  }

  const urls: string[] = []
  for (const row of rows.slice(0, 12)) {
    if (!row.date || !row.quarter || !row.year) continue
    for (const firmSlug of firmSlugs) {
      for (const slug of slugVarianten(firmSlug, tickers[0], row.quarter, row.year)) {
        for (const pfad of datumPfade(row.date)) {
          urls.push(`${FOOL_ORIGIN}/earnings/call-transcripts/${pfad}/${slug}/`)
        }
      }
    }
  }
  return [...new Set(urls)]
}

async function kandidatenViaQuartalsRaster(
  tickers: string[],
  firmSlugs: string[],
): Promise<string[]> {
  if (firmSlugs.length === 0 || tickers.length === 0) return []
  const sym = tickers[0]
  const urls: string[] = []

  for (const { quartal, jahr } of letzteBerichtsQuartale(MAX_QUARTALS_RASTER)) {
    const { jahr: cj, monat } = callMonatFuerQuartal(quartal, jahr)
    for (const firmSlug of firmSlugs) {
      for (const slug of slugVarianten(firmSlug, sym, quartal, jahr)) {
        for (const pfad of datumPfadeMonat(cj, monat)) {
          urls.push(`${FOOL_ORIGIN}/earnings/call-transcripts/${pfad}/${slug}/`)
        }
      }
    }
  }

  return [...new Set(urls)]
}

async function kandidatenViaDuckDuckGo(ticker: string, firmenname: string | null): Promise<string[]> {
  const urls: string[] = []
  for (const q of suchQueriesFuerTicker(ticker, firmenname)) {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const html = await res.text()
      urls.push(
        ...[...html.matchAll(/uddg=([^&"]+)/g)]
          .map((m) => decodeURIComponent(m[1]))
          .filter((u) => u.includes('fool.com/earnings/call-transcripts')),
      )
    } catch {
      continue
    }
  }
  return [...new Set(urls)]
}

async function kandidatenViaArchiv(tickers: string[], maxLinks: number): Promise<string[]> {
  const gefunden: string[] = []

  for (let seite = 1; seite <= MAX_ARCHIVE_PAGES; seite++) {
    if (gefunden.length >= maxLinks) break
    if (seite > 1) await sleep(ARCHIVE_PAGE_DELAY_MS)

    const pfad =
      seite === 1 ? '/earnings-call-transcripts/' : `/earnings-call-transcripts/page/${seite}/`
    const { ok, html, status } = await foolFetch(pfad)
    if (status === 429 || !ok) break

    const links = extrahiereArchiveLinks(html)
    if (links.length === 0) break

    for (const rel of links) {
      const slug = rel.split('/').filter(Boolean).pop()?.replace(/\/$/, '') ?? ''
      if (!slugPasstZuTicker(slug, tickers)) continue
      gefunden.push(`${FOOL_ORIGIN}${rel}`)
      if (gefunden.length >= maxLinks) break
    }
  }

  return [...new Set(gefunden)]
}

function parseFoolArtikel(html: string, url: string): { titel: string; callDatum: string | null; text: string } | null {
  if (html.length < 3000) return null
  if (/captcha|access denied|please verify/i.test(html.slice(0, 5000))) return null

  const ogTitle = html.match(/property="og:title" content="([^"]+)"/i)?.[1]?.trim()
  if (ogTitle === 'The Motley Fool' && html.length < 20_000) return null

  const slug = url.split('/').filter(Boolean).pop() ?? ''
  let titel =
    ogTitle ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ??
    titelAusSlug(slug)
  if (titel === 'The Motley Fool') titel = titelAusSlug(slug)

  const callDatum =
    html.match(/property="article:published_time" content="([^"]+)"/i)?.[1]?.slice(0, 10) ??
    datumAusFoolUrl(url)

  const articleHtml = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html
  const text = htmlZuFliesstext(articleHtml)
  if (text.length < 800) return null
  if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) return null

  return { titel, callDatum, text }
}

async function ladeFoolArtikel(url: string): Promise<FoolTranscript | null> {
  await sleep(ARTICLE_DELAY_MS)
  const { ok, html, status } = await foolFetch(url)
  if (!ok || status === 429) return null
  const parsed = parseFoolArtikel(html, url)
  if (!parsed) return null
  return { url, ...parsed }
}

async function filterExistierendeUrls(urls: string[], tickers: string[]): Promise<string[]> {
  const valid: string[] = []
  for (const url of urls) {
    if (valid.length >= MAX_URL_KANDIDATEN) break
    const slug = url.split('/').filter(Boolean).pop() ?? ''
    if (!slugPasstZuTicker(slug, tickers)) continue
    if (await foolUrlExistiert(url)) valid.push(url.split('?')[0])
    await sleep(50)
  }
  return [...new Set(valid)]
}

function budgetAbgelaufen(start: number): boolean {
  return Date.now() - start > DISCOVERY_BUDGET_MS
}

export async function ladeMotleyFoolTranskriptHistorie(
  ticker: string,
  firmenname?: string | null,
  max = 8,
): Promise<FoolTranscript[]> {
  const start = Date.now()
  const tickers = normalisiereFoolTicker(ticker)
  if (tickers.length === 0) return []

  const firmSlugs = firmSlugsFuerTicker(ticker, firmenname ?? null)

  const [ddg, bing, yahoo, finnhub] = await Promise.all([
    kandidatenViaDuckDuckGo(ticker, firmenname ?? null),
    kandidatenViaBing(ticker, firmenname ?? null),
    kandidatenViaYahoo(tickers, firmSlugs),
    kandidatenViaFinnhubKalender(ticker, firmSlugs, tickers),
  ])

  let kandidaten = [...new Set([...ddg, ...bing, ...yahoo, ...finnhub])]

  if (kandidaten.length < max && !budgetAbgelaufen(start)) {
    const raster = await kandidatenViaQuartalsRaster(tickers, firmSlugs)
    const zuPruefen = [...new Set([...yahoo, ...finnhub, ...raster])].slice(0, MAX_URL_KANDIDATEN * 2)
    const existierend = await filterExistierendeUrls(zuPruefen, tickers)
    kandidaten = [...new Set([...kandidaten, ...existierend])]
  }

  if (kandidaten.length < max && !budgetAbgelaufen(start)) {
    const archiv = await kandidatenViaArchiv(tickers, max + 2)
    kandidaten = [...new Set([...kandidaten, ...archiv])]
  }

  const out: FoolTranscript[] = []
  const seen = new Set<string>()

  for (const url of kandidaten) {
    if (out.length >= max || budgetAbgelaufen(start)) break
    const key = url.split('?')[0]
    if (seen.has(key)) continue
    seen.add(key)

    const art = await ladeFoolArtikel(key)
    if (art) out.push(art)
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}

/** MarketBeat / Quartr — kostenlose Earnings-Call-Transkripte (US-Titel, z. B. Mastercard). */

import 'server-only'

import {
  istEarningsCallTranskript,
  istPresseMitteilung,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'

export type MarketbeatTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

const ORIGIN = 'https://www.marketbeat.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 18_000
const DISCOVERY_BUDGET_MS = 55_000
const ARTICLE_DELAY_MS = 120

const US_BOERSEN = ['NYSE', 'NASDAQ', 'AMEX'] as const

/** Yahoo-Suffix → MarketBeat-Börsencode (EU & weitere internationale Listings). */
const YAHOO_SUFFIX_ZU_MB: Record<string, string> = {
  PA: 'EPA',
  AS: 'AMS',
  DE: 'FRA',
  F: 'FRA',
  BE: 'EBR',
  BR: 'EBR',
  SW: 'SWX',
  HM: 'FRA',
  SG: 'FRA',
  MU: 'FRA',
  L: 'LON',
  ST: 'STO',
  HE: 'HEL',
  CO: 'CPH',
  OL: 'OSL',
  MI: 'BIT',
  MC: 'BME',
  VI: 'VIE',
  PR: 'PRA',
  WA: 'WSE',
  TO: 'TSE',
  V: 'CVE',
  AX: 'ASX',
  HK: 'HKG',
  T: 'TYO',
}

function marketbeatBoersenKandidaten(symbolYahoo: string | null | undefined, ticker: string): string[] {
  const sym = (symbolYahoo ?? ticker).trim().toUpperCase()
  const base = sym.includes('.') ? sym.split('.')[0]! : sym
  const out: string[] = []

  if (sym.includes('.')) {
    const suffix = sym.split('.').pop()!
    const mb = YAHOO_SUFFIX_ZU_MB[suffix]
    if (mb) out.push(mb)
  }

  for (const b of US_BOERSEN) out.push(b)
  if (out.length === 0) return [...US_BOERSEN]
  return [...new Set(out)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalisiereTicker(ticker: string): string {
  const t = ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  return t.includes('.') ? t.split('.')[0] : t
}

function firmennameZuSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc\.?|corp\.?|corporation|ltd\.?|limited|llc|plc|ag|se|sa|nv|co\.?|group|holding[s]?|incorporated)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function mbFetch(url: string): Promise<{ ok: boolean; html: string; status: number }> {
  const abs = url.startsWith('http') ? url : `${ORIGIN}${url}`
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

function datumAusReportUrl(url: string): string | null {
  const m = url.match(/\/earnings\/reports\/(\d{4})-(\d{1,2})-(\d{1,2})-/i)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

function reportUrlsAusHtml(html: string): string[] {
  const urls = [
    ...html.matchAll(/href="(\/earnings\/reports\/\d{4}-\d{1,2}-\d{1,2}-[^"#?]+-stock\/)/gi),
  ].map((m) => `${ORIGIN}${m[1]}`)
  return [...new Set(urls)]
}

function sortiereReportUrls(urls: string[]): string[] {
  return [...urls].sort((a, b) => (datumAusReportUrl(b) ?? '').localeCompare(datumAusReportUrl(a) ?? ''))
}

function passtReportZuTicker(url: string, ticker: string, firmSlug: string | null): boolean {
  const slug = url.split('/').filter(Boolean).pop()?.replace(/\/$/, '') ?? ''
  const t = ticker.toLowerCase()
  if (slug.includes(`-${t}-`) || slug.endsWith(`-${t}-stock`) || slug.includes(`${t}-stock`)) return true
  if (firmSlug && slug.includes(firmSlug)) return true
  return false
}

async function kandidatenViaEarningsSeite(
  ticker: string,
  firmSlug: string | null,
  symbolYahoo?: string | null,
): Promise<string[]> {
  const sym = normalisiereTicker(ticker)
  const gefunden: string[] = []

  for (const boerse of marketbeatBoersenKandidaten(symbolYahoo, ticker)) {
    const { ok, html, status } = await mbFetch(`/stocks/${boerse}/${sym}/earnings/`)
    if (status === 404 || !ok) continue
    // Eigene /stocks/{Börse}/{Ticker}/earnings/-Seite — alle Report-Links gehören zum Titel
    const urls = reportUrlsAusHtml(html)
    gefunden.push(...urls)
    if (urls.length > 0) break
  }

  return sortiereReportUrls(gefunden)
}

async function kandidatenViaBing(ticker: string, firmenname: string | null): Promise<string[]> {
  const sym = normalisiereTicker(ticker)
  const slug = firmenname ? firmennameZuSlug(firmenname) : ''
  const queries = [
    `site:marketbeat.com/earnings/reports ${sym} transcript`,
    firmenname ? `site:marketbeat.com/earnings/reports ${firmenname} earnings call transcript` : '',
    firmenname ? `site:marketbeat.com/earnings/reports ${firmenname} conference call transcript` : '',
    slug ? `site:marketbeat.com/earnings/reports ${slug}` : '',
    slug ? `site:marketbeat.com/earnings/reports ${slug}-stock transcript` : '',
  ].filter(Boolean)

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
        ...[...html.matchAll(/https:\/\/www\.marketbeat\.com\/earnings\/reports\/[^"&]+/g)]
          .map((m) => m[0].replace(/&amp;/g, '&').split('&')[0])
          .filter((u) => u.endsWith('-stock/') || u.endsWith('-stock')),
      )
    } catch {
      continue
    }
  }

  return sortiereReportUrls([...new Set(urls.map((u) => (u.endsWith('/') ? u : `${u}/`)))])
}

function htmlZuTranskriptText(html: string): { titel: string; text: string } | null {
  const titel =
    html.match(/id="transcript"><h3>([^<]+)/i)?.[1]?.trim() ??
    html.match(/<h3[^>]*>([^<]*Earnings Call Transcript[^<]*)</i)?.[1]?.trim() ??
    'Earnings Call Transcript'

  const discussionIdx = html.search(/class="transcript-discussion[\s"]/)
  const start = discussionIdx >= 0 ? discussionIdx : html.indexOf('id="transcript"')
  if (start < 0) return null

  const section = html.slice(start, start + 800_000)

  const parts: string[] = []
  const zeilen = section.split(/<(?:section|div) class="transcript-line-left/i).slice(1)
  for (const chunk of zeilen) {
    const speaker =
      chunk.match(/transcript-line-speaker[\s\S]*?font-weight-bold">\s*([^<]+?)\s*<\/div>/i)?.[1]
        ?.replace(/\s+/g, ' ')
        .trim() ?? ''
    const speech = chunk
      .match(/<p class="pb-2 mb-0">([\s\S]*?)<\/p>/i)?.[1]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim()
    if (!speech || speech.length < 8) continue
    if (/provided by quartr/i.test(speaker)) continue
    parts.push(speaker ? `${speaker}: ${speech}` : speech)
  }

  const text = parts.join('\n\n')
  if (text.length < 800) return null
  if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) return null

  return { titel, text }
}

async function ladeReportTranskript(url: string): Promise<MarketbeatTranscript | null> {
  await sleep(ARTICLE_DELAY_MS)
  const { ok, html, status } = await mbFetch(url)
  if (!ok || status === 404) return null

  const parsed = htmlZuTranskriptText(html)
  if (!parsed) return null

  return {
    url: url.split('#')[0],
    titel: parsed.titel,
    callDatum: datumAusReportUrl(url),
    text: parsed.text,
  }
}

function budgetAbgelaufen(start: number): boolean {
  return Date.now() - start > DISCOVERY_BUDGET_MS
}

/** Bis zu `max` Earnings-Transkripte von MarketBeat (Quartr). */
export async function ladeMarketbeatTranskriptHistorie(
  ticker: string,
  firmenname?: string | null,
  max = 8,
  symbolYahoo?: string | null,
): Promise<MarketbeatTranscript[]> {
  const start = Date.now()
  const sym = normalisiereTicker(ticker)
  if (!sym) return []

  const firmSlug = firmenname?.trim() ? firmennameZuSlug(firmenname) : null

  const [direkt, bing] = await Promise.all([
    kandidatenViaEarningsSeite(sym, firmSlug, symbolYahoo ?? ticker),
    kandidatenViaBing(sym, firmenname ?? null),
  ])

  const kandidaten = sortiereReportUrls([
    ...new Set([
      ...direkt,
      ...bing.filter((u) => passtReportZuTicker(u, sym, firmSlug)),
    ]),
  ])
  const out: MarketbeatTranscript[] = []
  const seen = new Set<string>()

  for (const url of kandidaten) {
    if (out.length >= max || budgetAbgelaufen(start)) break
    const key = url.split('#')[0]
    if (seen.has(key)) continue
    seen.add(key)

    const art = await ladeReportTranskript(key)
    if (art) out.push(art)
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}

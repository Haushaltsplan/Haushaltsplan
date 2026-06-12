/** Investing.com — Earnings-Call-Transkripte (EU & internationale Titel). */

import 'server-only'

import { htmlZuFliesstext } from '@/lib/html/text-aus-html'
import {
  istEarningsCallTranskript,
  istPresseMitteilung,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'

export type InvestingTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

const ORIGIN = 'https://www.investing.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 20_000
const ARTICLE_DELAY_MS = 250

let sessionCookie = ''

function suchQueries(firmenname: string, ticker: string): string[] {
  const name = firmenname.trim()
  const sym = ticker.trim().toUpperCase().split('.')[0]!
  const kurzName = name.replace(/\s+(holding|group|se|sa|nv|ag|plc|inc|corp)\.?$/i, '').trim()
  const out = [
    sym ? `${sym} earnings call transcript` : '',
    kurzName && kurzName !== sym ? `${kurzName} earnings call transcript` : '',
    name ? `${name} earnings call transcript` : '',
    sym ? `${sym} conference call transcript` : '',
    name ? `${name} conference call transcript` : '',
  ].filter(Boolean)
  return [...new Set(out)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cookiesAusResponse(res: Response): void {
  const raw = res.headers.getSetCookie?.() ?? []
  for (const c of raw) {
    const part = c.split(';')[0]?.trim()
    if (part) sessionCookie = sessionCookie ? `${sessionCookie}; ${part}` : part
  }
}

async function investingFetch(
  pathOrUrl: string,
  referer?: string,
): Promise<{ ok: boolean; html: string; status: number }> {
  const abs = pathOrUrl.startsWith('http') ? pathOrUrl : `${ORIGIN}${pathOrUrl}`
  try {
    const res = await fetch(abs, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: referer ?? `${ORIGIN}/`,
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    cookiesAusResponse(res)
    return { ok: res.ok, html: await res.text(), status: res.status }
  } catch {
    return { ok: false, html: '', status: 0 }
  }
}

function transcriptLinksAusSuche(html: string): string[] {
  const paths = [
    ...html.matchAll(/href="(\/news\/transcripts\/[^"#?]+)"/gi),
    ...html.matchAll(/href='(\/news\/transcripts\/[^'#?]+)'/gi),
  ].map((m) => m[1]!)
  return [...new Set(paths.map((p) => (p.endsWith('/') ? p : `${p}/`)))]
}

function datumAusHtml(html: string, url: string): string | null {
  const pub =
    html.match(/Published[^0-9]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i) ??
    html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/i)
  if (pub) {
    if (pub[1]?.length === 4) return pub[1]
    return `${pub[3]}-${String(pub[1]).padStart(2, '0')}-${String(pub[2]).padStart(2, '0')}`
  }
  const m = url.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function htmlZuInvestingTranskript(html: string, url: string): { titel: string; text: string } | null {
  const titel =
    html.match(/<h1[^>]*id="articleTitle"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ??
    html.match(/<h1[^>]*>([^<]*[Ee]arnings[^<]*)<\/h1>/i)?.[1]?.trim() ??
    'Earnings Call Transcript'

  const marker = html.search(/Full transcript/i)
  if (marker < 0) return null

  let chunk = html.slice(marker, marker + 350_000)
  const stop = chunk.search(/Related Articles|More Transcripts|Sign Up|Advertisement/i)
  if (stop > 500) chunk = chunk.slice(0, stop)

  const text = htmlZuFliesstext(chunk)
    .replace(/^Full transcript[^\n]*\n?/i, '')
    .replace(/^Earnings call transcript[^\n]*\n?/i, '')
    .trim()

  if (text.length < 600) return null
  if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) return null

  return { titel, text }
}

async function kandidatenViaSuche(firmenname: string, ticker: string): Promise<string[]> {
  const urls: string[] = []
  for (const q of suchQueries(firmenname, ticker)) {
    const searchPath = `/search/?q=${encodeURIComponent(q)}&tab=news`
    const { ok, html } = await investingFetch(searchPath)
    if (!ok) continue
    urls.push(...transcriptLinksAusSuche(html))
    if (urls.length >= 12) break
    await sleep(120)
  }
  return [...new Set(urls)]
}

async function ladeArtikel(path: string, searchReferer: string): Promise<InvestingTranscript | null> {
  await sleep(ARTICLE_DELAY_MS)
  const { ok, html, status } = await investingFetch(path, `${ORIGIN}${searchReferer}`)
  if (!ok || status === 404) return null

  const parsed = htmlZuInvestingTranskript(html, path)
  if (!parsed) return null

  return {
    url: `${ORIGIN}${path.split('#')[0]}`,
    titel: parsed.titel,
    callDatum: datumAusHtml(html, path),
    text: parsed.text,
  }
}

/** Bis zu `max` Transkripte von Investing.com (primär EU). */
export async function ladeInvestingTranskriptHistorie(
  ticker: string,
  firmenname?: string | null,
  max = 8,
): Promise<InvestingTranscript[]> {
  sessionCookie = ''
  const name = firmenname?.trim() || ticker
  const kandidaten = await kandidatenViaSuche(name, ticker)
  if (kandidaten.length === 0) return []

  const out: InvestingTranscript[] = []
  const seen = new Set<string>()

  for (const path of kandidaten) {
    if (out.length >= max) break
    const key = path.replace(/\/$/, '')
    if (seen.has(key)) continue
    seen.add(key)

    const art = await ladeArtikel(path, `/search/?q=${encodeURIComponent(name)}&tab=news`)
    if (art) out.push(art)
  }

  out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
  return out.slice(0, max)
}

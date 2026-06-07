import 'server-only'

import { decodeXmlText } from '@/lib/google-news-rss'
import type { FundamentalNewsArtikel } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

export type { FundamentalNewsArtikel }

/** Bekannte Ticker → Suchbegriffe für News-Relevanz */
const TICKER_NEWS_ALIASES: Record<string, string[]> = {
  GOOGL: ['Alphabet', 'Google'],
  GOOG: ['Alphabet', 'Google'],
  META: ['Meta Platforms', 'Facebook'],
  FB: ['Meta Platforms', 'Facebook'],
  AMZN: ['Amazon'],
  MSFT: ['Microsoft'],
  AAPL: ['Apple'],
  NVDA: ['Nvidia', 'NVIDIA'],
  TSLA: ['Tesla'],
  BRK: ['Berkshire Hathaway'],
  BRK_A: ['Berkshire Hathaway'],
  BRK_B: ['Berkshire Hathaway'],
}

const LISTICLE_MUSTER =
  /\b(these \d+|best \d+|top \d+|magnificent seven|stocks to buy|unexpected winners?|ai stocks|megacap stock|watch now|you should buy)\b/i

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function baueNewsReferenzen(symbol: string, firmenname: string): string[] {
  const sym = symbol.trim().toUpperCase()
  const basis = firmenname
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+(Inc\.?|Corp\.?|Corporation|Ltd\.?|AG|SE|PLC|NV).*$/i, '')
    .trim()
  const ausTicker = TICKER_NEWS_ALIASES[sym] ?? []
  return [...new Set([sym, ...ausTicker, basis, firmenname.trim()].filter((s) => s.length >= 2))]
}

function textEnthaeltReferenz(text: string, refs: string[]): boolean {
  for (const ref of refs) {
    if (ref.length <= 5) {
      if (new RegExp(`\\b${escapeRegex(ref)}\\b`, 'i').test(text)) return true
    } else if (text.toLowerCase().includes(ref.toLowerCase())) {
      return true
    }
  }
  return false
}

function newsIstRelevant(titel: string, zusammenfassung: string, refs: string[]): boolean {
  const kombi = `${titel} ${zusammenfassung}`
  if (!textEnthaeltReferenz(kombi, refs)) return false
  if (LISTICLE_MUSTER.test(titel) && !textEnthaeltReferenz(titel, refs.filter((r) => r.length > 5))) {
    return false
  }
  return true
}

async function ladeYahooRssNews(symbol: string): Promise<FundamentalNewsArtikel[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) return []
  const xml = await res.text()
  const out: FundamentalNewsArtikel[] = []
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && out.length < 20) {
    const block = m[1]
    const titel = decodeXmlText(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    const link = decodeXmlText(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '')
    const desc = decodeXmlText(block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '')
    const pub = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]
    const ts = pub ? Date.parse(decodeXmlText(pub)) : NaN
    if (titel && link) {
      out.push({
        titel,
        link,
        quelle: 'Yahoo Finance',
        veroeffentlicht: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
        zusammenfassung: desc || null,
      })
    }
  }
  return out
}

async function ladeGoogleNewsDe(query: string): Promise<FundamentalNewsArtikel[]> {
  const u = new URL('https://news.google.com/rss/search')
  u.searchParams.set('q', query)
  u.searchParams.set('hl', 'de')
  u.searchParams.set('gl', 'DE')
  u.searchParams.set('ceid', 'DE:de')
  const res = await fetch(u.toString(), { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) return []
  const xml = await res.text()
  const out: FundamentalNewsArtikel[] = []
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && out.length < 15) {
    const block = m[1]
    const titel = decodeXmlText(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    const link = decodeXmlText(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '')
    const pub = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]
    const ts = pub ? Date.parse(decodeXmlText(pub)) : NaN
    const quelle = titel.includes(' - ') ? titel.split(' - ').pop()?.trim() ?? 'Google News' : 'Google News'
    const titelClean = titel.includes(' - ') ? titel.split(' - ').slice(0, -1).join(' - ').trim() : titel
    if (titelClean && link) {
      out.push({
        titel: titelClean,
        link,
        quelle,
        veroeffentlicht: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
        zusammenfassung: null,
      })
    }
  }
  return out
}

export async function ladeFundamentalNews(symbol: string, firmenname?: string): Promise<FundamentalNewsArtikel[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const refs = baueNewsReferenzen(sym, firmenname ?? sym)
  const seen = new Set<string>()
  const roh: FundamentalNewsArtikel[] = []

  const [yahooRss, googleDe] = await Promise.all([
    ladeYahooRssNews(sym),
    ladeGoogleNewsDe(`"${firmenname ?? sym}" ${sym} Aktie`),
  ])

  for (const n of [...yahooRss, ...googleDe]) {
    if (seen.has(n.link)) continue
    seen.add(n.link)
    roh.push(n)
  }

  const relevant = roh.filter((n) =>
    newsIstRelevant(n.titel, n.zusammenfassung ?? '', refs),
  )

  relevant.sort((a, b) => {
    const ta = a.veroeffentlicht ? Date.parse(a.veroeffentlicht) : 0
    const tb = b.veroeffentlicht ? Date.parse(b.veroeffentlicht) : 0
    return tb - ta
  })

  return relevant.slice(0, 10)
}

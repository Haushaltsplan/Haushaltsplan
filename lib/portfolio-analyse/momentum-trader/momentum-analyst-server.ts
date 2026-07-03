/**
 * Analyst-Ratings — MarketBeat Ratings-Seite (Scraper).
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  marketbeatBasisTicker,
  marketbeatBoersenKandidaten,
} from '@/lib/portfolio-analyse/marketbeat-earnings-transcript-server'
import { ANALYST_AKTION_MAX_TAGE } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumAnalystAktion,
  MomentumAnalystRating,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const ORIGIN = 'https://www.marketbeat.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 6 * 60 * 60 * 1000
const pageCache = new Map<string, { at: number; ratings: MomentumAnalystRating[] }>()

function zellenText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDatumUs(text: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

function parseRatingAktion(text: string): MomentumAnalystAktion | null {
  const t = text.toLowerCase()
  if (/\bupgrade/.test(t)) return 'upgrade'
  if (/\bdowngrade/.test(t)) return 'downgrade'
  if (/\binitiat/.test(t)) return 'initiate'
  if (/\breiterat/.test(t)) return 'reiterate'
  if (/\btarget|price target/.test(t)) return 'target'
  return null
}

function parseRatingWechsel(text: string): { alt: string | null; neu: string | null } {
  const m = /([^➝]+)➝\s*([^➝]+)/.exec(text) ?? /(\w+)\s+to\s+(\w+)/i.exec(text)
  if (!m) return { alt: null, neu: zellenText(text) || null }
  return { alt: zellenText(m[1]), neu: zellenText(m[2]) }
}

/** Ratings-Tabelle / Aktionsliste aus MarketBeat HTML. */
export function parseMarketbeatAnalystRatings(html: string, symbol: string): MomentumAnalystRating[] {
  const out: MomentumAnalystRating[] = []
  const seen = new Set<string>()

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => zellenText(m[1]))
    if (tds.length < 3) continue

    const rowText = tds.join(' ')
    const aktion = parseRatingAktion(rowText)
    if (!aktion) continue

    let datum: string | null = null
    for (const td of tds) {
      datum = parseDatumUs(td) ?? datum
    }
    if (!datum) datum = heuteIsoUtc()

    const ratingCell = tds.find((t) => /➝|buy|hold|sell|outperform|underperform|neutral/i.test(t)) ?? ''
    const { alt, neu } = parseRatingWechsel(ratingCell)

    const firma = tds.find((t) => /bank|securities|capital|research|group/i.test(t)) ?? null
    const key = datum + aktion + (firma ?? '')
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      symbol: symbol.toUpperCase(),
      datum,
      aktion,
      firma,
      ratingAlt: alt,
      ratingNeu: neu,
      zielpreisAlt: null,
      zielpreisNeu: null,
    })
  }

  // Fallback: Textblöcke „Upgraded by“ / „Downgraded by“
  if (out.length === 0) {
    for (const m of html.matchAll(
      /(Upgraded|Downgraded|Initiated|Reiterated)[\s\S]{0,120}?(Buy|Hold|Sell|Outperform|Underperform|Neutral)/gi,
    )) {
      const aktion = parseRatingAktion(m[1])
      if (!aktion) continue
      out.push({
        symbol: symbol.toUpperCase(),
        datum: heuteIsoUtc(),
        aktion,
        firma: null,
        ratingAlt: null,
        ratingNeu: m[2],
        zielpreisAlt: null,
        zielpreisNeu: null,
      })
      if (out.length >= 5) break
    }
  }

  return out.sort((a, b) => b.datum.localeCompare(a.datum))
}

async function ladeRatingsSeite(boerse: string, basis: string): Promise<string | null> {
  const url = `${ORIGIN}/stocks/${encodeURIComponent(boerse)}/${encodeURIComponent(basis)}/ratings/`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 5000 ? html : null
  } catch {
    return null
  }
}

/** Letzte Analyst-Aktionen für ein Symbol (max. 5). */
export async function ladeAnalystRatingsFuerSymbol(
  ticker: string,
  symbolYahoo?: string | null,
): Promise<MomentumAnalystRating[]> {
  const sym = ticker.trim().toUpperCase()
  const cacheKey = sym + '|' + (symbolYahoo ?? '')
  const cached = pageCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ratings

  const basis = marketbeatBasisTicker(ticker, symbolYahoo)
  const boersen = marketbeatBoersenKandidaten(symbolYahoo, ticker)

  for (const boerse of boersen) {
    const html = await ladeRatingsSeite(boerse, basis)
    if (!html) continue
    const ratings = parseMarketbeatAnalystRatings(html, sym)
    if (ratings.length > 0) {
      pageCache.set(cacheKey, { at: Date.now(), ratings })
      return ratings
    }
  }

  pageCache.set(cacheKey, { at: Date.now(), ratings: [] })
  return []
}

/** Neuestes Upgrade/Initiate innerhalb ANALYST_AKTION_MAX_TAGE. */
export function findeAktuellesUpgrade(ratings: MomentumAnalystRating[]): MomentumAnalystRating | null {
  const heute = heuteIsoUtc()
  return (
    ratings.find((r) => {
      if (r.aktion !== 'upgrade' && r.aktion !== 'initiate') return false
      return tageZwischenIso(r.datum, heute) <= ANALYST_AKTION_MAX_TAGE
    }) ?? null
  )
}

/** Batch — max. n Symbole mit Pause. */
export async function ladeAnalystRatingsBatch(
  eintraege: Array<{ symbol: string; symbolYahoo?: string | null }>,
  max = 8,
): Promise<Map<string, MomentumAnalystRating[]>> {
  const out = new Map<string, MomentumAnalystRating[]>()
  for (const e of eintraege.slice(0, max)) {
    const sym = e.symbol.trim().toUpperCase()
    const ratings = await ladeAnalystRatingsFuerSymbol(sym, e.symbolYahoo)
    if (ratings.length > 0) out.set(sym, ratings)
    await new Promise((r) => setTimeout(r, 900))
  }
  return out
}

/**
 * News-Katalysatoren — Google News RSS pro Symbol.
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  googleNewsItemsNachDatumFiltern,
  googleNewsItemsNachDatumSortieren,
  parseGoogleNewsRssItems,
} from '@/lib/google-news-rss'
import { NEWS_MAX_ALTER_TAGE } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumNewsKatalysator,
  MomentumNewsSentiment,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const CACHE_MS = 2 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: MomentumNewsKatalysator | null }>()

const BULLISH =
  /\b(beat|surge|soar|rally|upgrade|raises?|raised|bullish|record|strong|growth|partnership|deal|approval|breakthrough|buy rating|outperform)\b/i
const BEARISH =
  /\b(miss|plunge|drop|fall|downgrade|cut|cuts|warning|weak|lawsuit|investigation|recall|layoff|bearish|underperform|sell rating|probe)\b/i

function klassifiziereSentiment(text: string): MomentumNewsSentiment {
  const bull = (text.match(BULLISH) ?? []).length
  const bear = (text.match(BEARISH) ?? []).length
  if (bull > bear && bull >= 1) return 'bullish'
  if (bear > bull && bear >= 1) return 'bearish'
  return 'neutral'
}

/** Relevante News der letzten N Tage für ein Symbol. */
export async function ladeNewsKatalysatorFuerSymbol(
  symbol: string,
  firmenName?: string | null,
): Promise<MomentumNewsKatalysator | null> {
  const sym = symbol.trim().toUpperCase()
  const key = sym + '|' + (firmenName ?? '')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const suchbegriffe = [sym]
  if (firmenName?.trim()) suchbegriffe.push('"' + firmenName.trim().replace(/"/g, '') + '"')
  const q = '(' + suchbegriffe.join(' OR ') + ') AND (stock OR shares OR earnings OR analyst)'
  const url =
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent(q) +
    '&hl=en&gl=US&ceid=US:en'

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'mein-haushalt/1.0 (momentum news)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      cache.set(key, { at: Date.now(), data: null })
      return null
    }
    const xml = await res.text()
    const maxAlterMs = NEWS_MAX_ALTER_TAGE * 24 * 60 * 60 * 1000
    const items = googleNewsItemsNachDatumSortieren(
      googleNewsItemsNachDatumFiltern(parseGoogleNewsRssItems(xml, 'Google News', 12), maxAlterMs),
    )
    const top = items[0]
    if (!top?.veroeffentlichtAm) {
      cache.set(key, { at: Date.now(), data: null })
      return null
    }

    const datum = top.veroeffentlichtAm.slice(0, 10)
    const tageAlt = tageZwischenIso(datum, heuteIsoUtc())
    const sentiment = klassifiziereSentiment(top.titel + ' ' + top.beschreibung)

    const data: MomentumNewsKatalysator = {
      symbol: sym,
      headline: top.titel,
      href: top.href,
      veroeffentlichtAm: top.veroeffentlichtAm,
      sentiment,
      tageAlt,
    }
    cache.set(key, { at: Date.now(), data })
    return data
  } catch {
    cache.set(key, { at: Date.now(), data: null })
    return null
  }
}

/** Batch mit Pause — max. n Symbole. */
export async function ladeNewsKatalysatorenBatch(
  eintraege: Array<{ symbol: string; name?: string | null }>,
  max = 10,
): Promise<Map<string, MomentumNewsKatalysator>> {
  const out = new Map<string, MomentumNewsKatalysator>()
  const slice = eintraege.slice(0, max)
  for (const e of slice) {
    const sym = e.symbol.trim().toUpperCase()
    const news = await ladeNewsKatalysatorFuerSymbol(sym, e.name)
    if (news) out.set(sym, news)
    await new Promise((r) => setTimeout(r, 600))
  }
  return out
}

export { klassifiziereSentiment }

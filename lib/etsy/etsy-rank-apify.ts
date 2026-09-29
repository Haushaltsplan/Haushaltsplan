/**
 * Rank-Tracking: Etsy-Suche (HTML, meist DataDome-geblockt) → Fallback Open-API-Relevanz,
 * optional Apify-Actor wenn APIFY_API_TOKEN + APIFY_ETSY_ACTOR_ID gesetzt.
 */

import 'server-only'

import {
  ladeEtsyFokusKeywords,
  speichereEtsyRankErgebnisse,
} from '@/lib/etsy/etsy-seo-audit-cache'
import type { EtsyRankKeywordResult, EtsyRankTrackingResult } from '@/lib/etsy/etsy-seo-audit-types'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { sucheEtsyReihenfolge, type EtsySuchReihenfolge } from '@/lib/etsy/etsy-scraping'

const SEITE = 48

export function apifyKonfiguriert(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_ETSY_ACTOR_ID?.trim())
}

function positionAus(
  reihenfolge: EtsySuchReihenfolge | null,
  keyword: string,
  listingId: number,
): EtsyRankKeywordResult {
  if (!reihenfolge) {
    return { keyword, page: null, position: null, found: false, note: 'Suche nicht erreichbar' }
  }
  const proxy = reihenfolge.provider === 'etsy_api_relevanz' ? ' (API-Relevanz)' : ''
  const idx = reihenfolge.listingIds.indexOf(listingId)
  if (idx < 0) {
    return {
      keyword,
      page: null,
      position: null,
      found: false,
      note: `Nicht in den ersten ${reihenfolge.listingIds.length} Treffern${proxy}.`,
    }
  }
  return {
    keyword,
    page: Math.floor(idx / SEITE) + 1,
    position: idx + 1,
    found: true,
    note: proxy ? proxy.trim() : undefined,
  }
}

async function trackeViaApify(opts: {
  listingId: number
  keywords: string[]
}): Promise<EtsyRankKeywordResult[] | null> {
  const token = process.env.APIFY_API_TOKEN?.trim()
  const actorId = process.env.APIFY_ETSY_ACTOR_ID?.trim()
  if (!token || !actorId) return null

  // Actor-Input ist je nach Actor unterschiedlich — wir übergeben ein generisches Such-Schema.
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=120`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: opts.keywords,
        keywords: opts.keywords,
        searchQueries: opts.keywords,
        search: opts.keywords[0],
        maxItems: 100,
        listingId: opts.listingId,
      }),
      signal: AbortSignal.timeout(130_000),
    },
  )
  if (!runRes.ok) {
    const t = await runRes.text()
    throw new Error(`Apify Run fehlgeschlagen (${runRes.status}): ${t.slice(0, 200)}`)
  }
  const run = (await runRes.json()) as {
    data?: { defaultDatasetId?: string; status?: string }
  }
  const datasetId = run.data?.defaultDatasetId
  if (!datasetId) return null

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!itemsRes.ok) return null
  const items = (await itemsRes.json()) as unknown
  if (!Array.isArray(items)) return null

  const results: EtsyRankKeywordResult[] = []
  for (const keyword of opts.keywords) {
    let foundAt = -1
    let i = 0
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const id =
        Number(o.listingId ?? o.listing_id ?? o.id) ||
        (typeof o.url === 'string' ? Number(/\/listing\/(\d+)/.exec(o.url)?.[1]) : NaN)
      const kw = String(o.keyword || o.query || o.search || '').toLowerCase()
      if (kw && kw !== keyword.toLowerCase()) continue
      if (id === opts.listingId) {
        foundAt = i
        break
      }
      i++
    }
    results.push(
      foundAt >= 0
        ? {
            keyword,
            page: Math.floor(foundAt / SEITE) + 1,
            position: foundAt + 1,
            found: true,
            note: 'Apify',
          }
        : { keyword, page: null, position: null, found: false, note: 'Apify: nicht gefunden' },
    )
  }
  return results
}

function providerAus(reihen: Array<EtsySuchReihenfolge | null>): EtsyRankTrackingResult['provider'] {
  if (reihen.some((r) => r?.provider === 'etsy_search')) return 'etsy_search'
  if (reihen.some((r) => r?.provider === 'etsy_api_relevanz')) return 'etsy_api_relevanz'
  return 'unavailable'
}

export async function trackeEtsyListingRanks(opts: {
  ownerUserId?: string
  listingId: number
  listingUrl?: string | null
  keywords: string[]
}): Promise<EtsyRankTrackingResult> {
  const checkedAt = new Date().toISOString()
  const keywords = opts.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 6)

  if (keywords.length === 0) {
    return { listingId: opts.listingId, checkedAt, provider: 'unavailable', results: [] }
  }

  let results: EtsyRankKeywordResult[] | null = null
  let provider: EtsyRankTrackingResult['provider'] = 'unavailable'

  if (apifyKonfiguriert()) {
    try {
      results = await trackeViaApify({ listingId: opts.listingId, keywords })
      if (results) provider = 'apify'
    } catch (e) {
      console.warn('[etsy-rank] Apify:', e instanceof Error ? e.message : e)
    }
  }

  if (!results) {
    const reihen: Array<EtsySuchReihenfolge | null> = []
    results = []
    for (const keyword of keywords) {
      const r = await sucheEtsyReihenfolge(keyword)
      reihen.push(r)
      results.push(positionAus(r, keyword, opts.listingId))
    }
    provider = providerAus(reihen)
  }

  if (opts.ownerUserId && provider !== 'unavailable') {
    try {
      await speichereEtsyRankErgebnisse({
        ownerUserId: opts.ownerUserId,
        listingId: opts.listingId,
        results,
        provider,
      })
    } catch (e) {
      console.warn('[etsy-rank] cache:', e instanceof Error ? e.message : e)
    }
  }

  return { listingId: opts.listingId, checkedAt, provider, results }
}

export type EtsyShopRankLauf = {
  shopId: number
  keywords: number
  listings: number
  provider: EtsyRankTrackingResult['provider']
  ergebnisse: EtsyRankTrackingResult[]
}

/**
 * Shop-weites Tracking: jedes Fokus-Keyword wird nur einmal gesucht und gegen
 * alle Listings ausgewertet. Fokus = bisher getrackte Keywords je Listing,
 * sonst die ersten 3 Mehrwort-Tags.
 */
export async function trackListingRanks(opts: {
  ownerUserId: string
  maxKeywords?: number
  maxListings?: number
}): Promise<EtsyShopRankLauf> {
  const maxKeywords = Math.max(1, Math.min(40, opts.maxKeywords ?? 25))
  const { shopId, listings } = await ladeEtsyShopListings(opts.ownerUserId, {
    state: 'active',
    limit: Math.min(100, opts.maxListings ?? 100),
  })
  const fokus = await ladeEtsyFokusKeywords(opts.ownerUserId)

  const keywordZuListings = new Map<string, number[]>()
  for (const l of listings) {
    const eigene = fokus.get(l.listingId)
    const kws = (eigene && eigene.length > 0
      ? eigene
      : l.tags.filter((t) => t.trim().includes(' ')).slice(0, 3)
    ).map((k) => k.trim().toLowerCase())
    for (const k of kws.slice(0, 3)) {
      if (!k) continue
      const arr = keywordZuListings.get(k) ?? []
      arr.push(l.listingId)
      keywordZuListings.set(k, arr)
    }
  }

  // Keywords mit den meisten Listings zuerst — ein Such-Request deckt viele ab.
  const keywords = [...keywordZuListings.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxKeywords)

  const proListing = new Map<number, EtsyRankKeywordResult[]>()
  const reihen: Array<EtsySuchReihenfolge | null> = []
  const providerJeListing = new Map<number, EtsySuchReihenfolge['provider']>()
  for (const [keyword, ids] of keywords) {
    const r = await sucheEtsyReihenfolge(keyword)
    reihen.push(r)
    for (const id of ids) {
      const arr = proListing.get(id) ?? []
      arr.push(positionAus(r, keyword, id))
      proListing.set(id, arr)
      if (r) providerJeListing.set(id, r.provider)
    }
  }

  const checkedAt = new Date().toISOString()
  const ergebnisse: EtsyRankTrackingResult[] = []
  for (const [listingId, results] of proListing) {
    const provider = providerJeListing.get(listingId) ?? 'unavailable'
    if (provider !== 'unavailable') {
      try {
        await speichereEtsyRankErgebnisse({ ownerUserId: opts.ownerUserId, listingId, results, provider })
      } catch (e) {
        console.warn('[etsy-rank] shop cache:', e instanceof Error ? e.message : e)
      }
    }
    ergebnisse.push({ listingId, checkedAt, provider, results })
  }

  return {
    shopId,
    keywords: keywords.length,
    listings: proListing.size,
    provider: providerAus(reihen),
    ergebnisse,
  }
}

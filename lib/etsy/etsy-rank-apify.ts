/**
 * Rank-Tracking: Etsy-Suche scrapen (funktioniert sofort)
 * + optional Apify-Actor wenn APIFY_API_TOKEN + APIFY_ETSY_ACTOR_ID gesetzt.
 */

import 'server-only'

import { speichereEtsyRankErgebnisse } from '@/lib/etsy/etsy-seo-audit-cache'
import type { EtsyRankKeywordResult, EtsyRankTrackingResult } from '@/lib/etsy/etsy-seo-audit-types'

export function apifyKonfiguriert(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_ETSY_ACTOR_ID?.trim())
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Extrahiert Listing-IDs aus Etsy-Such-HTML (Reihenfolge ≈ Ranking). */
function extractListingIdsFromHtml(html: string): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  const re = /\/listing\/(\d+)\//g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const id = Number(m[1])
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= 120) break
  }
  return ids
}

async function sucheEtsyListingPosition(
  keyword: string,
  listingId: number,
): Promise<EtsyRankKeywordResult> {
  const q = encodeURIComponent(keyword)
  const url = `https://www.etsy.com/search?q=${q}&explicit=1&ref=search_bar`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OmniaEtsySeo/1.0; +https://haushaltsplan-blue.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      return {
        keyword,
        page: null,
        position: null,
        found: false,
        note: `Etsy-Suche HTTP ${res.status}`,
      }
    }
    const html = await res.text()
    const ids = extractListingIdsFromHtml(html)
    const idx = ids.indexOf(listingId)
    if (idx < 0) {
      return {
        keyword,
        page: null,
        position: null,
        found: false,
        note: `Nicht in den ersten ${ids.length} Treffern der Suche.`,
      }
    }
    const position = idx + 1
    const page = Math.floor(idx / 48) + 1
    return { keyword, page, position, found: true }
  } catch (e) {
    return {
      keyword,
      page: null,
      position: null,
      found: false,
      note: e instanceof Error ? e.message.slice(0, 120) : 'Suche fehlgeschlagen',
    }
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
  if (!datasetId) {
    return opts.keywords.map((keyword) => ({
      keyword,
      page: null,
      position: null,
      found: false,
      note: 'Apify lieferte kein Dataset — Fallback auf Etsy-Suche.',
    }))
  }

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

  // Flexible Auswertung: suche listingId in Items
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
    if (foundAt >= 0) {
      results.push({
        keyword,
        page: Math.floor(foundAt / 48) + 1,
        position: foundAt + 1,
        found: true,
        note: 'Apify',
      })
    } else {
      results.push({
        keyword,
        page: null,
        position: null,
        found: false,
        note: 'Apify: nicht gefunden',
      })
    }
  }
  return results
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
    return {
      listingId: opts.listingId,
      checkedAt,
      provider: 'unavailable',
      results: [],
    }
  }

  let results: EtsyRankKeywordResult[] | null = null
  let provider: EtsyRankTrackingResult['provider'] = 'etsy_search'

  if (apifyKonfiguriert()) {
    try {
      results = await trackeViaApify({ listingId: opts.listingId, keywords })
      if (results) provider = 'apify'
    } catch (e) {
      console.warn('[etsy-rank] Apify:', e instanceof Error ? e.message : e)
    }
  }

  if (!results) {
    provider = 'etsy_search'
    results = []
    for (const keyword of keywords) {
      results.push(await sucheEtsyListingPosition(keyword, opts.listingId))
      await sleep(400)
    }
  }

  if (opts.ownerUserId) {
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

  return {
    listingId: opts.listingId,
    checkedAt,
    provider,
    results,
  }
}

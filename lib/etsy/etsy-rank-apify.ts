/**
 * Rank-Tracking für die Shop-Matrix:
 * Primär Apify (echte Etsy-Suche) — Open-API-Proxy gilt nicht als brauchbares Ergebnis.
 */

import 'server-only'

import { speichereEtsyRankErgebnisse } from '@/lib/etsy/etsy-seo-audit-cache'
import type { EtsyRankKeywordResult, EtsyRankTrackingResult } from '@/lib/etsy/etsy-seo-audit-types'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import {
  etsyCircuitOffen,
  markiereEtsyApifyFehler,
  markiereEtsyApifyOk,
} from '@/lib/etsy/etsy-circuit-breaker'
import {
  etsyHtmlCircuitOffen,
  etsyHtmlCircuitRestMs,
  sucheEtsyReihenfolge,
  syncEtsyHtmlCircuitFromDb,
  type EtsySuchReihenfolge,
} from '@/lib/etsy/etsy-scraping'

const SEITE = 48
/** Unter dieser Trefferzahl keine belastbare Seiten-/Platz-Aussage. */
export const ETSY_RANK_MIN_PROBE = 48
/** Default-Actor: günstiger Etsy-Search-Scraper (~1 USD / 1000 Treffer). */
export const ETSY_APIFY_DEFAULT_ACTOR = 'omkar-cloud/etsy-scraper'
const APIFY_MAX_PER_SEARCH = 120

export function apifyToken(): string | null {
  return process.env.APIFY_API_TOKEN?.trim() || null
}

export function apifyActorId(): string {
  return process.env.APIFY_ETSY_ACTOR_ID?.trim() || ETSY_APIFY_DEFAULT_ACTOR
}

export function apifyKonfiguriert(): boolean {
  return Boolean(apifyToken())
}

type RankReihenfolge = {
  keyword: string
  listingIds: number[]
  provider: 'apify' | 'etsy_search' | 'etsy_api_relevanz'
  sampleSize: number
}

function positionAus(
  reihenfolge: RankReihenfolge | null,
  keyword: string,
  listingId: number,
): EtsyRankKeywordResult {
  if (!reihenfolge) {
    return { keyword, page: null, position: null, found: false, note: 'Suche nicht erreichbar' }
  }
  const n = reihenfolge.listingIds.length
  const belastbar = n >= ETSY_RANK_MIN_PROBE
  const idx = reihenfolge.listingIds.indexOf(listingId)
  const src =
    reihenfolge.provider === 'apify'
      ? 'Apify'
      : reihenfolge.provider === 'etsy_search'
        ? 'Etsy-Suche'
        : 'API-Relevanz'

  if (!belastbar) {
    return {
      keyword,
      page: null,
      position: null,
      found: false,
      note: `Messung unbrauchbar · nur ${n} Treffer (${src})`,
    }
  }

  if (idx < 0) {
    return {
      keyword,
      page: null,
      position: null,
      found: false,
      note: `Nicht in den ersten ${n} Treffern (${src})`,
    }
  }
  return {
    keyword,
    page: Math.floor(idx / SEITE) + 1,
    position: idx + 1,
    found: true,
    note: src,
  }
}

function listingIdAusItem(o: Record<string, unknown>): number | null {
  const direct = Number(o.listingId ?? o.listing_id ?? o.id)
  if (Number.isFinite(direct) && direct > 0) return direct
  const link = typeof o.link === 'string' ? o.link : typeof o.url === 'string' ? o.url : ''
  const m = /\/listing\/(\d+)/.exec(link)
  if (m) {
    const id = Number(m[1])
    if (Number.isFinite(id) && id > 0) return id
  }
  return null
}

async function holeApifyDatasetItems(token: string, datasetId: string): Promise<unknown[]> {
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60_000),
    },
  )
  if (!itemsRes.ok) {
    throw new Error(`Apify Dataset lesen fehlgeschlagen (${itemsRes.status})`)
  }
  const items = (await itemsRes.json()) as unknown
  if (!Array.isArray(items)) throw new Error('Apify Dataset war kein Array')
  return items
}

/**
 * Ein Apify-Run für alle Keywords (searchQueries).
 * Erwartetes Output: omkar-cloud/etsy-scraper → { query, id|link, … }
 */
export async function sucheFokusKeywordsViaApify(
  keywords: string[],
): Promise<Map<string, RankReihenfolge>> {
  const token = apifyToken()
  if (!token) throw new Error('APIFY_API_TOKEN fehlt in .env.local / Vercel.')

  const actorId = apifyActorId()
  const kws = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
  if (!kws.length) return new Map()

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=240`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchQueries: kws,
        queries: kws,
        keywords: kws,
        maxResultsPerSearch: APIFY_MAX_PER_SEARCH,
        maxItems: APIFY_MAX_PER_SEARCH * kws.length,
        scrapeListingDetails: false,
        excludeSponsored: true,
        locale: 'de',
        currency: 'EUR',
        startUrls: kws.map(
          (q) => `https://www.etsy.com/de/search?q=${encodeURIComponent(q)}&ship_to=DE&explicit=1`,
        ),
      }),
      signal: AbortSignal.timeout(250_000),
    },
  )
  if (!runRes.ok) {
    const t = await runRes.text()
    throw new Error(`Apify Run fehlgeschlagen (${runRes.status}): ${t.slice(0, 240)}`)
  }
  const run = (await runRes.json()) as {
    data?: { defaultDatasetId?: string; status?: string }
  }
  const status = String(run.data?.status || '')
  const datasetId = run.data?.defaultDatasetId
  if (!datasetId) {
    throw new Error(`Apify ohne Dataset (Status: ${status || 'unbekannt'})`)
  }
  if (status && status !== 'SUCCEEDED') {
    throw new Error(`Apify Run Status: ${status}`)
  }

  const items = await holeApifyDatasetItems(token, datasetId)
  const map = new Map<string, number[]>()
  for (const kw of kws) map.set(kw, [])

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = listingIdAusItem(o)
    if (id == null) continue
    const rawKw = String(o.query || o.keyword || o.search || o.searchQuery || '')
      .toLowerCase()
      .trim()
    let target: string | null = rawKw && map.has(rawKw) ? rawKw : null
    if (!target) {
      const blob = `${o.input_url || o.url || o.link || ''}`.toLowerCase()
      target =
        kws.find(
          (kw) => blob.includes(encodeURIComponent(kw)) || blob.includes(kw.replace(/\s+/g, '+')),
        ) ?? null
    }
    if (!target && kws.length === 1) target = kws[0]!
    if (!target) continue
    const arr = map.get(target)!
    if (!arr.includes(id) && arr.length < APIFY_MAX_PER_SEARCH) arr.push(id)
  }

  const out = new Map<string, RankReihenfolge>()
  for (const kw of kws) {
    const ids = map.get(kw) ?? []
    out.set(kw, { keyword: kw, listingIds: ids, provider: 'apify', sampleSize: ids.length })
  }
  return out
}

async function trackeViaApify(opts: {
  listingId: number
  keywords: string[]
}): Promise<EtsyRankKeywordResult[] | null> {
  const reihen = await sucheFokusKeywordsViaApify(opts.keywords)
  return opts.keywords.map((keyword) => {
    const k = keyword.trim().toLowerCase()
    return positionAus(reihen.get(k) ?? null, k, opts.listingId)
  })
}

function providerAus(
  reihen: Array<RankReihenfolge | EtsySuchReihenfolge | null>,
): EtsyRankTrackingResult['provider'] {
  if (reihen.some((r) => r && 'provider' in r && r.provider === 'apify')) return 'apify'
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

  await syncEtsyHtmlCircuitFromDb()
  const apifyOffen = await etsyCircuitOffen('apify')

  if (apifyKonfiguriert() && !apifyOffen) {
    try {
      results = await trackeViaApify({ listingId: opts.listingId, keywords })
      if (results) {
        provider = 'apify'
        await markiereEtsyApifyOk()
      } else {
        await markiereEtsyApifyFehler('leeres Apify-Ergebnis')
      }
    } catch (e) {
      await markiereEtsyApifyFehler(e instanceof Error ? e.message : 'Apify Fehler')
      console.warn('[etsy-rank] Apify:', e instanceof Error ? e.message : e)
    }
  } else if (apifyOffen) {
    console.info(`[etsy-rank] Apify Circuit offen (DB) — skip Apify`)
  }

  if (!results) {
    if (etsyHtmlCircuitOffen()) {
      console.info(
        `[etsy-rank] HTML Circuit offen (${Math.round(etsyHtmlCircuitRestMs() / 1000)}s) — nur API-Relevanz`,
      )
    }
    const reihen: Array<EtsySuchReihenfolge | null> = []
    results = []
    try {
      for (const keyword of keywords) {
        const r = await sucheEtsyReihenfolge(keyword)
        reihen.push(r)
        results.push(
          positionAus(
            r
              ? {
                  keyword,
                  listingIds: r.listingIds,
                  provider: r.provider,
                  sampleSize: r.listingIds.length,
                }
              : null,
            keyword,
            opts.listingId,
          ),
        )
      }
      provider = providerAus(reihen)
    } catch (e) {
      console.warn('[etsy-rank] Suche:', e instanceof Error ? e.message : e)
      results = keywords.map((keyword) => ({
        keyword,
        page: null,
        position: null,
        found: false,
        note: 'Suche übersprungen (Circuit/Fehler)',
      }))
      provider = 'unavailable'
    }
  }

  // Nur belastbare Apify-Ergebnisse cachen (kein API-Müll)
  if (opts.ownerUserId && provider === 'apify') {
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
  belastbar: boolean
  sampleMin: number
  sampleAvg: number
  hinweis: string | null
}

/**
 * Shop-weites Tracking (Legacy/Cron-Nebenpfad).
 */
export async function trackListingRanks(opts: {
  ownerUserId: string
  maxKeywords?: number
  maxListings?: number
}): Promise<EtsyShopRankLauf> {
  // Fokus-Matrix ist der kanonische Pfad — gleiche Keywords / Apify.
  return trackeFokusRankMatrix({
    ownerUserId: opts.ownerUserId,
    maxListings: opts.maxListings,
  })
}

/**
 * Shop-Matrix: 5 feste Keywords via Apify (Pflicht für brauchbare Ranks).
 */
export async function trackeFokusRankMatrix(opts: {
  ownerUserId: string
  maxListings?: number
}): Promise<EtsyShopRankLauf> {
  const { ETSY_RANK_FOKUS_KEYWORDS } = await import('@/lib/etsy/etsy-rank-fokus')
  const keywords = [...ETSY_RANK_FOKUS_KEYWORDS]

  if (!apifyKonfiguriert()) {
    throw new Error(
      'APIFY_API_TOKEN fehlt. Ohne Apify keine belastbaren Ranks (Free-Credits reichen alle 1–2 Wochen). Eintragen in .env.local und Vercel → Environment Variables.',
    )
  }

  const apifyOffen = await etsyCircuitOffen('apify')
  if (apifyOffen) {
    throw new Error('Apify vorübergehend gesperrt (Circuit nach Fehlern). In ~20 Min. erneut versuchen.')
  }

  const { shopId, listings } = await ladeEtsyShopListings(opts.ownerUserId, {
    state: 'active',
    limit: Math.min(100, opts.maxListings ?? 100),
  })
  const listingIds = listings.map((l) => l.listingId)

  let reihenMap: Map<string, RankReihenfolge>
  try {
    reihenMap = await sucheFokusKeywordsViaApify(keywords)
    await markiereEtsyApifyOk()
  } catch (e) {
    await markiereEtsyApifyFehler(e instanceof Error ? e.message : 'Apify Fehler')
    throw e instanceof Error ? e : new Error('Apify Rank-Messung fehlgeschlagen')
  }

  const samples = keywords.map((k) => reihenMap.get(k)?.sampleSize ?? 0)
  const sampleMin = samples.length ? Math.min(...samples) : 0
  const sampleAvg = samples.length
    ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    : 0
  const belastbar = sampleMin >= ETSY_RANK_MIN_PROBE

  if (!belastbar) {
    throw new Error(
      `Apify lieferte zu wenige Treffer (min. ${sampleMin}, brauchen ≥${ETSY_RANK_MIN_PROBE} je Keyword). Actor „${apifyActorId()}“ prüfen oder Free-Credits.`,
    )
  }

  const proListing = new Map<number, EtsyRankKeywordResult[]>()
  for (const id of listingIds) {
    const results = keywords.map((keyword) =>
      positionAus(reihenMap.get(keyword) ?? null, keyword, id),
    )
    proListing.set(id, results)
  }

  const checkedAt = new Date().toISOString()
  const ergebnisse: EtsyRankTrackingResult[] = []
  for (const [listingId, results] of proListing) {
    try {
      await speichereEtsyRankErgebnisse({
        ownerUserId: opts.ownerUserId,
        listingId,
        results,
        provider: 'apify',
      })
    } catch (e) {
      console.warn('[etsy-rank] fokus matrix cache:', e instanceof Error ? e.message : e)
    }
    ergebnisse.push({ listingId, checkedAt, provider: 'apify', results })
  }

  return {
    shopId,
    keywords: keywords.length,
    listings: proListing.size,
    provider: 'apify',
    ergebnisse,
    belastbar: true,
    sampleMin,
    sampleAvg,
    hinweis: null,
  }
}

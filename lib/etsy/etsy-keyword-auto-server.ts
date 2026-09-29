/**
 * Automatischer Keyword-Scan für den eigenen Shop:
 * Listings → Suchfelder → Etsy/Google/Amazon → Lücken vs. eigene Tags.
 */

import 'server-only'

import {
  anreichereAutoKeywords,
  leiteKeywordSeeds,
  mergeKeywordIdeen,
  filtereChancen,
  menschAnhaengeAusListings,
  type AutoSeedListing,
} from '@/lib/etsy/etsy-keyword-auto'
import type { EtsyAutoKeywordScan, EtsyKeywordIdee } from '@/lib/etsy/etsy-markt-types'
import { chanceAus, erkundeEtsyKeywords, getCompetitorInsights } from '@/lib/etsy/etsy-scraping'
import { ladeEtsyHauptbegriffe } from '@/lib/etsy/etsy-seo-audit-cache'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const AUTO_TTL_MS = 24 * 60 * 60 * 1000
const MAX_WETTBEWERB = 16

async function ladeAktiveListings(ownerUserId: string): Promise<AutoSeedListing[]> {
  const out: AutoSeedListing[] = []
  for (let offset = 0; offset < 300; offset += 100) {
    const { listings } = await ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100, offset })
    for (const l of listings) out.push({ title: l.title, tags: l.tags ?? [], views: l.views ?? null })
    if (listings.length < 100) break
  }
  return out
}

async function konkurrenzTagZaehler(ownerUserId: string): Promise<Map<string, number>> {
  const { data } = await createSupabaseAdmin()
    .from('etsy_konkurrenz_shop')
    .select('top_tags')
    .eq('owner_user_id', ownerUserId)
    .eq('aktiv', true)
    .eq('eigener', false)
  const z = new Map<string, number>()
  for (const s of data ?? []) {
    const tags = Array.isArray(s.top_tags) ? (s.top_tags as unknown[]).map((t) => String(t).toLowerCase().trim()) : []
    for (const t of new Set(tags)) z.set(t, (z.get(t) ?? 0) + 1)
  }
  return z
}

function cacheKey(ownerUserId: string): string {
  return `keyword_auto:${ownerUserId}`.slice(0, 200)
}

export async function ladeGecachtenKeywordScan(ownerUserId: string): Promise<EtsyAutoKeywordScan | null> {
  const { data } = await createSupabaseAdmin()
    .from('etsy_markt_cache')
    .select('payload, fetched_at')
    .eq('cache_key', cacheKey(ownerUserId))
    .maybeSingle()
  if (!data) return null
  const at = new Date(String(data.fetched_at)).getTime()
  if (!Number.isFinite(at) || Date.now() - at >= AUTO_TTL_MS) return null
  const p = data.payload as EtsyAutoKeywordScan
  if (!p?.alle) return null
  return { ...p, ausCache: true }
}

async function speichereScan(ownerUserId: string, scan: EtsyAutoKeywordScan): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from('etsy_markt_cache')
    .upsert({
      cache_key: cacheKey(ownerUserId),
      kind: 'keyword_auto',
      payload: { ...scan, ausCache: true },
      fetched_at: new Date().toISOString(),
    })
  if (error) console.warn('[etsy keyword-auto cache]', error.message)
}

export async function scanneEtsyKeywordsFuerShop(
  ownerUserId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<EtsyAutoKeywordScan> {
  if (!opts.forceRefresh) {
    const cached = await ladeGecachtenKeywordScan(ownerUserId)
    if (cached) return cached
  }

  const [listings, hauptbegriffe, konkurrenzTags] = await Promise.all([
    ladeAktiveListings(ownerUserId),
    ladeEtsyHauptbegriffe(ownerUserId).catch(() => new Map<number, string>()),
    konkurrenzTagZaehler(ownerUserId),
  ])
  if (!listings.length) {
    return {
      seeds: [],
      listings: 0,
      chancen: [],
      alle: [],
      ausCache: false,
      stand: new Date().toISOString(),
      hinweise: ['Keine aktiven Listings — zuerst ein Listing anlegen oder Shop verbinden.'],
      abfragen: 0,
    }
  }

  const { seeds, holzKontext } = leiteKeywordSeeds(
    listings,
    [...new Set(hauptbegriffe.values())],
    konkurrenzTags,
  )
  const anhaenge = menschAnhaengeAusListings(listings)
  const deadline = Date.now() + 78_000
  const hinweise: string[] = []
  const laeufe: Array<{ seed: string; ideen: EtsyKeywordIdee[] }> = []
  let abfragen = 0
  const seedZuKeyword = new Map<string, string[]>()

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]!
    if (Date.now() > deadline) {
      hinweise.push('Zeitbudget — Teilergebnis aus den ersten Suchfeldern.')
      break
    }
    const rest = Math.max(8_000, deadline - Date.now())
    const r = await erkundeEtsyKeywords(s.seed, {
      tief: i < 2,
      menschlich: true,
      anhaenge,
      maxWettbewerb: 0,
      budgetMs: rest,
      holzKontext,
    })
    abfragen += r.abfragen
    hinweise.push(...r.hinweise.map((h) => `${s.seed}: ${h}`))
    laeufe.push({ seed: s.seed, ideen: r.ideen })
    for (const idee of r.ideen) {
      const k = idee.keyword.toLowerCase()
      seedZuKeyword.set(k, [...new Set([...(seedZuKeyword.get(k) ?? []), s.seed])])
    }
  }

  const gemergt = mergeKeywordIdeen(laeufe)
  const top = gemergt.slice(0, 80)
  for (const idee of top.slice(0, MAX_WETTBEWERB)) {
    if (Date.now() > deadline) break
    const c = await getCompetitorInsights(idee.keyword, { mitBadges: false })
    abfragen++
    if (c.provider === 'unavailable') continue
    idee.wettbewerb = c.wettbewerbCount
    idee.wettbewerbMarkt = c.marktFilter ?? null
    idee.chance = chanceAus(idee.nachfrage, c.wettbewerbCount)
  }

  const alle = anreichereAutoKeywords({ ideen: top, listings, konkurrenzTags, seedZuKeyword })
  const chancen = filtereChancen(alle)
  if (!chancen.length) hinweise.push('Keine klaren Lücken — deine Tags decken die häufigsten Suchen schon gut ab.')

  const scan: EtsyAutoKeywordScan = {
    seeds,
    listings: listings.length,
    chancen,
    alle,
    ausCache: false,
    stand: new Date().toISOString(),
    hinweise: [...new Set(hinweise.filter(Boolean))],
    abfragen,
  }
  await speichereScan(ownerUserId, scan)
  return scan
}

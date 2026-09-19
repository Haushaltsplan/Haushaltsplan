/** Etsy Listings lesen & aktualisieren (SEO-Überwachung). */

import 'server-only'

import {
  etsyFetchJson,
  holeGueltigenEtsyAccessToken,
  stelleShopIdSicher,
} from '@/lib/etsy/etsy-server'
import type { EtsyShopListingDetail, EtsyShopListingKurz } from '@/lib/etsy/etsy-seo-audit-types'

type EtsyListingApi = {
  listing_id?: number
  title?: string
  description?: string
  state?: string
  url?: string
  quantity?: number
  taxonomy_id?: number
  tags?: string[]
  materials?: string[]
  who_made?: string
  when_made?: string
  views?: number
  num_favorers?: number
  last_modified_timestamp?: number
  price?: { amount?: number; divisor?: number; currency_code?: string } | number | string
}

function priceEurFromApi(price: EtsyListingApi['price']): number | null {
  if (price == null) return null
  if (typeof price === 'number') return Number.isFinite(price) ? price : null
  if (typeof price === 'string') {
    const n = Number(price.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const amount = Number(price.amount)
  const divisor = Number(price.divisor) || 100
  if (!Number.isFinite(amount)) return null
  return Math.round((amount / divisor) * 100) / 100
}

function mapKurz(r: EtsyListingApi): EtsyShopListingKurz | null {
  const listingId = Number(r.listing_id)
  if (!Number.isFinite(listingId) || listingId <= 0) return null
  return {
    listingId,
    title: String(r.title || ''),
    state: String(r.state || ''),
    priceEur: priceEurFromApi(r.price),
    url: typeof r.url === 'string' ? r.url : null,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    views: r.views != null ? Number(r.views) : null,
    numFavorers: r.num_favorers != null ? Number(r.num_favorers) : null,
    updatedAt:
      r.last_modified_timestamp != null
        ? new Date(Number(r.last_modified_timestamp) * 1000).toISOString()
        : null,
  }
}

function mapDetail(r: EtsyListingApi): EtsyShopListingDetail | null {
  const kurz = mapKurz(r)
  if (!kurz) return null
  return {
    ...kurz,
    description: String(r.description || ''),
    quantity: r.quantity != null ? Number(r.quantity) : null,
    taxonomyId: r.taxonomy_id != null ? Number(r.taxonomy_id) : null,
    materials: Array.isArray(r.materials) ? r.materials.map(String) : [],
    whoMade: r.who_made != null ? String(r.who_made) : null,
    whenMade: r.when_made != null ? String(r.when_made) : null,
  }
}

export async function ladeEtsyShopListings(
  ownerUserId: string,
  opts?: { state?: string; limit?: number; offset?: number },
): Promise<{ shopId: number; listings: EtsyShopListingKurz[] }> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)
  const state = opts?.state || 'active'
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50))
  const offset = Math.max(0, opts?.offset ?? 0)

  const q = new URLSearchParams({
    state,
    limit: String(limit),
    offset: String(offset),
  })

  const data = await etsyFetchJson<{ results?: EtsyListingApi[]; count?: number }>(
    tokens.accessToken,
    `/application/shops/${shopId}/listings?${q.toString()}`,
  )

  const listings = (data.results ?? [])
    .map(mapKurz)
    .filter((x): x is EtsyShopListingKurz => Boolean(x))

  return { shopId, listings }
}

export async function ladeEtsyListingDetail(
  ownerUserId: string,
  listingId: number,
): Promise<{ shopId: number; listing: EtsyShopListingDetail }> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)

  const data = await etsyFetchJson<EtsyListingApi>(
    tokens.accessToken,
    `/application/listings/${listingId}?includes=Images`,
  )
  const listing = mapDetail(data)
  if (!listing) throw new Error('Listing nicht gefunden oder ungültig.')

  return { shopId, listing }
}

export type EtsyListingUpdatePayload = {
  title?: string
  description?: string
  tags?: string[]
}

export async function updateEtsyListing(
  ownerUserId: string,
  listingId: number,
  updatedData: EtsyListingUpdatePayload,
): Promise<EtsyShopListingDetail> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)

  const body = new URLSearchParams()
  if (updatedData.title?.trim()) body.set('title', updatedData.title.trim().slice(0, 140))
  if (updatedData.description?.trim()) body.set('description', updatedData.description.trim())
  if (updatedData.tags?.length) {
    for (const t of updatedData.tags.slice(0, 13)) {
      const tag = t.trim().slice(0, 20)
      if (tag) body.append('tags', tag)
    }
  }
  if ([...body.keys()].length === 0) throw new Error('Keine Update-Felder gesetzt.')

  const data = await etsyFetchJson<EtsyListingApi>(
    tokens.accessToken,
    `/application/shops/${shopId}/listings/${listingId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  )

  const listing = mapDetail(data)
  if (!listing) {
    // Manche Antworten sind dünn — Detail neu laden
    const neu = await ladeEtsyListingDetail(ownerUserId, listingId)
    return neu.listing
  }
  return listing
}

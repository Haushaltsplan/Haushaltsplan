/** Etsy Listings lesen & aktualisieren (SEO-Überwachung). */

import 'server-only'

import {
  etsyFetchJson,
  holeGueltigenEtsyAccessToken,
  stelleShopIdSicher,
} from '@/lib/etsy/etsy-server'
import type { EtsyShopListingDetail, EtsyShopListingKurz } from '@/lib/etsy/etsy-seo-audit-types'
import { ETSY_SEO_TAG_COUNT } from '@/lib/etsy/etsy-seo-regeln'

type EtsyListingApi = {
  listing_id?: number
  title?: string
  description?: string
  state?: string
  url?: string
  quantity?: number
  taxonomy_id?: number
  tags?: string[] | string
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

function parseEtsyTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean)
  if (typeof raw === 'string') return raw.split(',').map((t) => t.trim()).filter(Boolean)
  return []
}

function etsyTagsFormWert(tags: string[]): string {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const t of tags) {
    const tag = t.trim().slice(0, 20)
    const k = tag.toLowerCase()
    if (!tag || seen.has(k)) continue
    seen.add(k)
    unique.push(tag)
    if (unique.length >= ETSY_SEO_TAG_COUNT) break
  }
  return unique.join(',')
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
    tags: parseEtsyTags(r.tags),
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
  let tagsSoll: string[] | null = null
  if (updatedData.tags) {
    const csv = etsyTagsFormWert(updatedData.tags)
    tagsSoll = csv ? csv.split(',') : []
    if (tagsSoll.length !== ETSY_SEO_TAG_COUNT) {
      throw new Error(
        `Genau ${ETSY_SEO_TAG_COUNT} Tags nötig (Etsy überschreibt sonst die komplette Liste). Aktuell ${tagsSoll.length}.`,
      )
    }
    // Komma-getrennt — mehrfaches append('tags') speichert bei Etsy nur den letzten Tag.
    body.set('tags', csv)
  }
  if ([...body.keys()].length === 0) throw new Error('Keine Update-Felder gesetzt.')

  const vorher =
    tagsSoll != null
      ? await ladeEtsyListingDetail(ownerUserId, listingId)
          .then((r) => r.listing)
          .catch(() => null)
      : null

  const data = await etsyFetchJson<EtsyListingApi>(
    tokens.accessToken,
    `/application/shops/${shopId}/listings/${listingId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  )

  let listing = mapDetail(data)
  if (!listing || (tagsSoll && parseEtsyTags(data.tags).length < ETSY_SEO_TAG_COUNT)) {
    listing = (await ladeEtsyListingDetail(ownerUserId, listingId)).listing
  }
  if (tagsSoll && listing.tags.length < ETSY_SEO_TAG_COUNT) {
    if (vorher && vorher.tags.length >= ETSY_SEO_TAG_COUNT) {
      await etsyFetchJson<EtsyListingApi>(
        tokens.accessToken,
        `/application/shops/${shopId}/listings/${listingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ tags: etsyTagsFormWert(vorher.tags) }),
        },
      ).catch(() => undefined)
    }
    throw new Error(
      `Etsy hat nur ${listing.tags.length} statt ${ETSY_SEO_TAG_COUNT} Tags übernommen — Update abgebrochen.`,
    )
  }
  if (!listing) throw new Error('Listing nach dem Update nicht lesbar.')
  return listing
}

/** Etsy Draft anlegen + Bilder hochladen. */

import 'server-only'

import { etsyFetchJson, stelleShopIdSicher, holeGueltigenEtsyAccessToken } from '@/lib/etsy/etsy-server'
import {
  ETSY_API_BASE,
  ETSY_DEFAULT_TAXONOMY_ID,
  etsyApiKeyHeader,
  type EtsyGeneratedListing,
  type EtsyListingBasis,
} from '@/lib/etsy/etsy-types'
import type { CoachImagePart } from '@/lib/ki-coach-backend'

export type EtsyDraftErgebnis = {
  listingId: number
  shopId: number
  title: string
  tags: string[]
  listingUrl: string | null
}

function mimeToExt(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

async function uploadListingImage(opts: {
  accessToken: string
  shopId: number
  listingId: number
  image: CoachImagePart
  rank: number
}): Promise<void> {
  const bytes = Uint8Array.from(Buffer.from(opts.image.base64, 'base64'))
  const ext = mimeToExt(opts.image.mimeType)
  const form = new FormData()
  form.append(
    'image',
    new Blob([bytes], { type: opts.image.mimeType || 'image/jpeg' }),
    `produkt-${opts.rank}.${ext}`,
  )
  form.append('rank', String(opts.rank))

  const res = await fetch(
    `${ETSY_API_BASE}/application/shops/${opts.shopId}/listings/${opts.listingId}/images`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'x-api-key': etsyApiKeyHeader(),
      },
      body: form,
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bild-Upload Rank ${opts.rank} fehlgeschlagen (${res.status}): ${text.slice(0, 300)}`)
  }
}

export async function legeEtsyDraftAn(opts: {
  ownerUserId: string
  basis: EtsyListingBasis
  listing: EtsyGeneratedListing
  images: CoachImagePart[]
}): Promise<EtsyDraftErgebnis> {
  const tokens = await holeGueltigenEtsyAccessToken(opts.ownerUserId)
  const shopId = await stelleShopIdSicher(opts.ownerUserId, tokens)

  const quantity = Math.max(1, Math.floor(opts.basis.quantity ?? 1))
  const price =
    opts.basis.preisEur != null && opts.basis.preisEur > 0
      ? Number(opts.basis.preisEur)
      : opts.listing.preisEmpfohlenEur
  if (!Number.isFinite(price) || price <= 0) throw new Error('Preis muss größer als 0 sein.')

  const shippingProfileId = Number(opts.basis.shippingProfileId)
  if (!Number.isFinite(shippingProfileId) || shippingProfileId <= 0) {
    throw new Error('shippingProfileId fehlt.')
  }

  const body = new URLSearchParams()
  body.set('quantity', String(quantity))
  body.set('title', opts.listing.title.slice(0, 140))
  body.set('description', opts.listing.description)
  body.set('price', String(price))
  body.set('who_made', opts.basis.whoMade ?? 'i_did')
  body.set('when_made', opts.basis.whenMade ?? 'made_to_order')
  body.set(
    'taxonomy_id',
    String(opts.basis.taxonomyId ?? opts.listing.taxonomyId ?? ETSY_DEFAULT_TAXONOMY_ID),
  )
  body.set('type', 'physical')
  body.set('shipping_profile_id', String(shippingProfileId))
  body.set('should_auto_renew', 'true')
  body.set('is_supply', 'false')
  body.set('is_customizable', 'false')
  body.set('is_personalizable', 'false')

  if (opts.basis.readinessStateId && opts.basis.readinessStateId > 0) {
    body.set('readiness_state_id', String(opts.basis.readinessStateId))
  }

  for (const tag of opts.listing.tags.slice(0, 13)) {
    body.append('tags', tag)
  }

  const materials =
    opts.basis.materials?.filter(Boolean) ??
    (opts.basis.holzart?.trim() ? [opts.basis.holzart.trim()] : [])
  for (const m of materials.slice(0, 13)) {
    body.append('materials', m.slice(0, 45))
  }

  const created = await etsyFetchJson<{ listing_id?: number; url?: string }>(
    tokens.accessToken,
    `/application/shops/${shopId}/listings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  )

  const listingId = Number(created.listing_id)
  if (!Number.isFinite(listingId) || listingId <= 0) {
    throw new Error('Etsy lieferte keine listing_id.')
  }

  let rank = 1
  for (const image of opts.images.slice(0, 10)) {
    await uploadListingImage({
      accessToken: tokens.accessToken,
      shopId,
      listingId,
      image,
      rank,
    })
    rank += 1
  }

  return {
    listingId,
    shopId,
    title: opts.listing.title,
    tags: opts.listing.tags,
    listingUrl: typeof created.url === 'string' ? created.url : null,
  }
}

/** Etsy Draft anlegen + Bilder hochladen. */

import 'server-only'

import {
  etsyFetchJson,
  stelleShopIdSicher,
  holeGueltigenEtsyAccessToken,
  ladeEtsyShopKontext,
} from '@/lib/etsy/etsy-server'
import {
  ETSY_API_BASE,
  ETSY_DEFAULT_TAXONOMY_ID,
  etsyApiKeyHeader,
  normalisiereEtsyWhenMade,
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

/** Etsy materials: nur Buchstaben/Zahlen/Leerzeichen, max 45. */
function sanitisiereMaterial(raw: string): string {
  return raw
    .replace(/[^a-zA-ZäöüÄÖÜß0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 45)
}

function readinessPasstZuWhenMade(readinessState: string, whenMade: string): boolean {
  const s = readinessState.toLowerCase()
  const auftrag = whenMade === 'made_to_order'
  if (auftrag) {
    return s.includes('made_to_order') || s.includes('auftrag') || s.includes('order')
  }
  return (
    s.includes('ready_to_ship') ||
    s.includes('ready') ||
    s.includes('versandfertig') ||
    s.includes('fertig')
  )
}

/** Physische Listings brauchen readiness_state_id — passend zu when_made. */
async function resolveReadinessStateId(
  ownerUserId: string,
  preferred: number | undefined,
  whenMade: string,
): Promise<number> {
  const ctx = await ladeEtsyShopKontext(ownerUserId)
  if (ctx.readinessStates.length === 0) {
    throw new Error(
      'Keine Bearbeitungszeit (readiness_state) im Etsy-Shop. Bitte in Etsy unter Versand → Bearbeitungszeit anlegen (für Unikate: „ready_to_ship“) und erneut versuchen.',
    )
  }

  if (preferred != null && Number.isFinite(preferred) && preferred > 0) {
    const hit = ctx.readinessStates.find((r) => r.readinessStateId === Math.floor(preferred))
    if (hit && readinessPasstZuWhenMade(hit.readinessState, whenMade)) {
      return hit.readinessStateId
    }
  }

  const prefer = ctx.readinessStates.find((r) => readinessPasstZuWhenMade(r.readinessState, whenMade))
  return prefer?.readinessStateId ?? ctx.readinessStates[0]!.readinessStateId
}

async function uploadListingImage(opts: {
  accessToken: string
  shopId: number
  listingId: number
  image: CoachImagePart
  rank: number
  altText: string
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
  if (opts.altText.trim()) {
    form.append('alt_text', opts.altText.trim().slice(0, 250))
  }

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

  /** Unikate: immer Stückzahl 1 — nie überverkaufbar. */
  const quantity = 1
  const price =
    opts.basis.preisEur != null && opts.basis.preisEur > 0
      ? Number(opts.basis.preisEur)
      : opts.listing.preisEmpfohlenEur
  if (!Number.isFinite(price) || price <= 0) throw new Error('Preis muss größer als 0 sein.')

  const shippingProfileId = Number(opts.basis.shippingProfileId)
  if (!Number.isFinite(shippingProfileId) || shippingProfileId <= 0) {
    throw new Error('shippingProfileId fehlt.')
  }

  const whenMade = normalisiereEtsyWhenMade(opts.basis.whenMade)
  const readinessStateId = await resolveReadinessStateId(
    opts.ownerUserId,
    opts.basis.readinessStateId,
    whenMade,
  )

  const materialsRaw =
    opts.basis.materials?.filter(Boolean) ??
    (opts.basis.holzart?.trim() ? [opts.basis.holzart.trim()] : [])
  const materials = materialsRaw.map(sanitisiereMaterial).filter(Boolean)
  if (materials.length === 0) {
    throw new Error('Holzart/Material fehlt — für Etsy-Materials Pflicht bei Unikat-Schalen.')
  }

  if (/\[MASSE EINFÜGEN\]/i.test(opts.listing.description)) {
    throw new Error('Maße fehlen noch ([MASSE EINFÜGEN] in der Beschreibung). Bitte Maße eintragen.')
  }
  if (opts.listing.tags.length < 13) {
    throw new Error(`Genau 13 Tags nötig — aktuell ${opts.listing.tags.length}.`)
  }

  const body = new URLSearchParams()
  body.set('quantity', String(quantity))
  body.set('title', opts.listing.title.slice(0, 140))
  body.set('description', opts.listing.description)
  body.set('price', String(price))
  body.set('who_made', opts.basis.whoMade ?? 'i_did')
  body.set('when_made', whenMade)
  body.set(
    'taxonomy_id',
    String(opts.basis.taxonomyId ?? opts.listing.taxonomyId ?? ETSY_DEFAULT_TAXONOMY_ID),
  )
  body.set('type', 'physical')
  body.set('shipping_profile_id', String(shippingProfileId))
  body.set('readiness_state_id', String(readinessStateId))
  body.set('should_auto_renew', 'true')
  body.set('is_supply', 'false')
  body.set('is_customizable', 'false')
  body.set('is_personalizable', 'false')

  if (opts.basis.shopSectionId && opts.basis.shopSectionId > 0) {
    body.set('shop_section_id', String(opts.basis.shopSectionId))
  }

  for (const tag of opts.listing.tags.slice(0, 13)) {
    body.append('tags', tag)
  }

  for (const m of materials.slice(0, 13)) {
    body.append('materials', m)
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

  const holz = opts.basis.holzart?.trim() || materials[0] || 'Holz'
  const masse = opts.basis.masse?.trim() || ''
  const altBasis = [holz, 'Schale handgedreht', masse || null, 'Unikat']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 250)

  let rank = 1
  for (const image of opts.images.slice(0, 10)) {
    const altText =
      rank === 1
        ? altBasis
        : `${holz} Detail Maserung · handgedrehte Schale`.slice(0, 250)
    await uploadListingImage({
      accessToken: tokens.accessToken,
      shopId,
      listingId,
      image,
      rank,
      altText,
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

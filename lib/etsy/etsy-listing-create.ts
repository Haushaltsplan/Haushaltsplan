/** Etsy Draft anlegen + Bilder hochladen + Attribute setzen. */

import 'server-only'

import {
  baueUnikatMaterials,
  baueWarenkorbZusammenfassung,
  leseListingTags,
  parseEtsyMasse,
  resolveSchalenShopSectionId,
  sanitisiereEtsyMaterial,
  sanitisiereEtsyTag,
  setzeEtsyUnikatAttribute,
  ETSY_DEKORATIVE_SCHALE_TAXONOMY_ID,
} from '@/lib/etsy/etsy-listing-attrs'
import {
  etsyFetchJson,
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
  warenkorbZusammenfassung: string
  /** Manuelle Schritte, die die API nicht setzen kann. */
  manuellHinweise: string[]
}

function mimeToExt(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
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
  const shopCtx = await ladeEtsyShopKontext(opts.ownerUserId)
  const shopId = shopCtx.shopId

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

  const shopSectionId = resolveSchalenShopSectionId(
    shopCtx.shopSections,
    opts.basis.shopSectionId,
  )

  const whenMade = normalisiereEtsyWhenMade(opts.basis.whenMade)
  const readinessStateId = await resolveReadinessStateId(
    opts.ownerUserId,
    opts.basis.readinessStateId,
    whenMade,
  )

  const holzart = opts.basis.holzart?.trim()
  if (!holzart) throw new Error('Holzart fehlt.')
  const masseRaw = opts.basis.masse?.trim()
  if (!masseRaw) throw new Error('Maße fehlen.')
  const masseParsed = parseEtsyMasse(masseRaw)
  if (!masseParsed) {
    throw new Error(
      `Maße nicht lesbar („${masseRaw}“). Bitte z. B. „22 × 8 cm“ oder „Ø 17 cm, H 5,5 cm“.`,
    )
  }

  const materials = baueUnikatMaterials(holzart)
    .map(sanitisiereEtsyMaterial)
    .filter(Boolean)
  if (materials.length < 2) {
    throw new Error('Materials: Holzart + lebensmittelechtes Walnussöl nötig.')
  }

  if (/\[MASSE EINFÜGEN\]/i.test(opts.listing.description)) {
    throw new Error('Maße fehlen noch ([MASSE EINFÜGEN] in der Beschreibung).')
  }

  const tags = [
    ...new Set(
      opts.listing.tags
        .map(sanitisiereEtsyTag)
        .filter(Boolean)
        .map((t) => t.slice(0, 20)),
    ),
  ].slice(0, 13)
  if (tags.length < 13) {
    throw new Error(`Genau 13 gültige Tags nötig — aktuell ${tags.length}.`)
  }

  const warenkorb =
    opts.listing.warenkorbZusammenfassung?.trim() ||
    baueWarenkorbZusammenfassung({
      holzart,
      masse: masseRaw,
      produktForm: opts.listing.produktForm,
      preisEur: price,
    })

  /** Warenkorb-Text in Beschreibung belassen (API hat kein eigenes Feld). */
  let description = opts.listing.description.trim()
  if (!description.includes(warenkorb.slice(0, 40))) {
    description = `${warenkorb}\n\n${description}`.trim()
  }

  const taxonomyId =
    opts.basis.taxonomyId && opts.basis.taxonomyId > 0
      ? opts.basis.taxonomyId
      : opts.listing.taxonomyId > 0
        ? opts.listing.taxonomyId
        : ETSY_DEKORATIVE_SCHALE_TAXONOMY_ID

  const body = new URLSearchParams()
  body.set('quantity', String(quantity))
  body.set('title', opts.listing.title.slice(0, 140))
  body.set('description', description)
  body.set('price', String(price))
  body.set('who_made', opts.basis.whoMade ?? 'i_did')
  body.set('when_made', whenMade)
  body.set('taxonomy_id', String(taxonomyId || ETSY_DEFAULT_TAXONOMY_ID))
  body.set('type', 'physical')
  body.set('shipping_profile_id', String(shippingProfileId))
  body.set('readiness_state_id', String(readinessStateId))
  body.set('shop_section_id', String(shopSectionId))
  body.set('should_auto_renew', 'true')
  body.set('is_supply', 'false')
  body.set('is_customizable', 'false')
  body.set('is_personalizable', 'false')
  /** Maße auch auf Listing-Ebene (zusätzlich zu Attribute-Properties). */
  body.set('item_width', String(masseParsed.breiteCm))
  body.set('item_height', String(masseParsed.hoeheCm))
  body.set('item_length', String(masseParsed.tiefeCm))
  body.set('item_dimensions_unit', 'cm')
  /** Komma-getrennt — Etsy erwartet eine Liste, nicht nur den letzten append. */
  body.set('tags', tags.join(','))
  body.set('materials', materials.join(','))

  const created = await etsyFetchJson<{ listing_id?: number; url?: string; tags?: string[] }>(
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

  /** Tags nachziehen, falls Create nicht alle übernommen hat. */
  let savedTags = Array.isArray(created.tags) ? created.tags.map(String) : []
  if (savedTags.length < 13) {
    try {
      savedTags = await leseListingTags(tokens.accessToken, listingId)
    } catch {
      /* ignore */
    }
  }
  if (savedTags.length < 13) {
    const fix = new URLSearchParams()
    fix.set('tags', tags.join(','))
    await etsyFetchJson(tokens.accessToken, `/application/shops/${shopId}/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fix,
    })
    try {
      savedTags = await leseListingTags(tokens.accessToken, listingId)
    } catch {
      savedTags = tags
    }
  }

  try {
    await setzeEtsyUnikatAttribute({
      accessToken: tokens.accessToken,
      shopId,
      listingId,
      holzart,
      masse: masseParsed,
    })
  } catch (e) {
    console.warn('[etsy] attribute set:', e instanceof Error ? e.message : e)
  }

  const altBasis = [materials[0], 'Schale handgedreht', masseRaw, 'Unikat']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 250)

  let rank = 1
  for (const image of opts.images.slice(0, 10)) {
    const altText =
      rank === 1
        ? altBasis
        : `${materials[0]} Detail Maserung · handgedrehte Schale`.slice(0, 250)
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
    tags: savedTags.length >= 13 ? savedTags : tags,
    listingUrl: typeof created.url === 'string' ? created.url : null,
    warenkorbZusammenfassung: warenkorb,
    manuellHinweise: [
      'Warenkorbzusammenfassung: in Etsy manuell einfügen (API unterstützt das DE-Pflichtfeld nicht) — Text unten kopieren.',
      'Herstellung: „Wird von Grund auf neu hergestellt“ in Etsy setzen (API-Lücke).',
      'Werkzeuge: „Handgeführte oder handgehaltene Werkzeuge“ in Etsy setzen (API-Lücke).',
    ],
  }
}

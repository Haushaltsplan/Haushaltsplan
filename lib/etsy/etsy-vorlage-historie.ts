/** Etsy Vorlagen + Draft-Historie (Supabase). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  defaultEtsyVorlage,
  type EtsyDraftHistorieEintrag,
  type EtsyGeneratedListing,
  type EtsyListingVorlage,
  type EtsyWhenMade,
  type EtsyWhoMade,
} from '@/lib/etsy/etsy-types'

export async function ladeEtsyVorlage(ownerUserId: string): Promise<EtsyListingVorlage> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_listing_vorlage')
    .select(
      'shipping_profile_id, readiness_state_id, taxonomy_id, standort_text, finish_text, who_made, when_made',
    )
    .eq('owner_user_id', ownerUserId)
    .maybeSingle()
  if (error || !data) return defaultEtsyVorlage()
  const base = defaultEtsyVorlage()
  return {
    shippingProfileId:
      data.shipping_profile_id != null ? Number(data.shipping_profile_id) : base.shippingProfileId,
    readinessStateId:
      data.readiness_state_id != null ? Number(data.readiness_state_id) : base.readinessStateId,
    taxonomyId: data.taxonomy_id != null ? Number(data.taxonomy_id) : base.taxonomyId,
    standortText: String(data.standort_text || base.standortText),
    finishText: String(data.finish_text || base.finishText),
    whoMade: (String(data.who_made || base.whoMade) as EtsyWhoMade) || base.whoMade,
    whenMade: (String(data.when_made || base.whenMade) as EtsyWhenMade) || base.whenMade,
  }
}

export async function speichereEtsyVorlage(
  ownerUserId: string,
  vorlage: EtsyListingVorlage,
): Promise<void> {
  const { error } = await createSupabaseAdmin().from('etsy_listing_vorlage').upsert({
    owner_user_id: ownerUserId,
    shipping_profile_id: vorlage.shippingProfileId,
    readiness_state_id: vorlage.readinessStateId,
    taxonomy_id: vorlage.taxonomyId,
    standort_text: vorlage.standortText.slice(0, 80),
    finish_text: vorlage.finishText.slice(0, 500),
    who_made: vorlage.whoMade,
    when_made: vorlage.whenMade,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Vorlage speichern: ${error.message}`)
}

export async function speichereEtsyDraftHistorie(opts: {
  ownerUserId: string
  listingId: number
  shopId: number
  listing: Pick<
    EtsyGeneratedListing,
    'title' | 'tags' | 'preisMinEur' | 'preisEmpfohlenEur' | 'preisMaxEur' | 'taxonomyId'
  >
  preisVerwendetEur: number
  holzart?: string
  listingUrl?: string | null
}): Promise<void> {
  const { error } = await createSupabaseAdmin().from('etsy_draft_historie').insert({
    owner_user_id: opts.ownerUserId,
    listing_id: opts.listingId,
    shop_id: opts.shopId,
    title: opts.listing.title.slice(0, 200),
    tags: opts.listing.tags,
    preis_min_eur: opts.listing.preisMinEur,
    preis_empfohlen_eur: opts.listing.preisEmpfohlenEur,
    preis_max_eur: opts.listing.preisMaxEur,
    preis_verwendet_eur: opts.preisVerwendetEur,
    taxonomy_id: opts.listing.taxonomyId,
    holzart: opts.holzart?.slice(0, 80) || null,
    listing_url: opts.listingUrl ?? null,
  })
  if (error) throw new Error(`Historie speichern: ${error.message}`)
}

export async function ladeEtsyDraftHistorie(
  ownerUserId: string,
  limit = 30,
): Promise<EtsyDraftHistorieEintrag[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_draft_historie')
    .select(
      'id, listing_id, shop_id, title, tags, preis_min_eur, preis_empfohlen_eur, preis_max_eur, preis_verwendet_eur, taxonomy_id, holzart, listing_url, created_at',
    )
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((r) => ({
    id: String(r.id),
    listingId: Number(r.listing_id),
    shopId: Number(r.shop_id),
    title: String(r.title || ''),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    preisMinEur: r.preis_min_eur != null ? Number(r.preis_min_eur) : null,
    preisEmpfohlenEur: r.preis_empfohlen_eur != null ? Number(r.preis_empfohlen_eur) : null,
    preisMaxEur: r.preis_max_eur != null ? Number(r.preis_max_eur) : null,
    preisVerwendetEur: Number(r.preis_verwendet_eur),
    taxonomyId: r.taxonomy_id != null ? Number(r.taxonomy_id) : null,
    holzart: r.holzart != null ? String(r.holzart) : null,
    listingUrl: r.listing_url != null ? String(r.listing_url) : null,
    createdAt: String(r.created_at),
  }))
}

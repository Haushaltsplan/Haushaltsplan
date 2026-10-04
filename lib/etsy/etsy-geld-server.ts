/** Phase A: Stückkosten, Preisampel, Monats-P&L, Portfolio-Wert. */

import 'server-only'

import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import {
  berechneMarge,
  type EtsyGeldErgebnis,
  type EtsyGeldListing,
  type EtsyKostenZeile,
  type EtsyShopEinstellungen,
  type EtsyStarSellerCheck,
} from '@/lib/etsy/etsy-shop-os-types'

export type { EtsyGeldErgebnis, EtsyGeldListing } from '@/lib/etsy/etsy-shop-os-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_EINSTELLUNGEN: EtsyShopEinstellungen = {
  zielMargePct: 55,
  etsyGebuehrPct: 6.5,
  paymentGebuehrPct: 4,
  paymentGebuehrFix: 0.25,
  kapazitaetProWoche: 4,
  starSeller: {},
}

function mapKosten(row: Record<string, unknown>): EtsyKostenZeile & {
  listingId: number
  listingTitle: string
  holzart: string | null
  notiz: string
} {
  return {
    listingId: Number(row.listing_id),
    listingTitle: String(row.listing_title || ''),
    holzart: row.holzart != null ? String(row.holzart) : null,
    holzEur: Number(row.holz_eur) || 0,
    oelEur: Number(row.oel_eur) || 0,
    schleifEur: Number(row.schleif_eur) || 0,
    werkzeugEur: Number(row.werkzeug_eur) || 0,
    stromEur: Number(row.strom_eur) || 0,
    verpackungEur: Number(row.verpackung_eur) || 0,
    sonstigesEur: Number(row.sonstiges_eur) || 0,
    arbeitsstunden: Number(row.arbeitsstunden) || 0,
    stundensatzEur: Number(row.stundensatz_eur) || 0,
    versandAnteilEur: Number(row.versand_anteil_eur) || 0,
    notiz: String(row.notiz || ''),
  }
}

export async function ladeEtsyEinstellungen(
  ownerUserId: string,
  sb?: SupabaseClient,
): Promise<EtsyShopEinstellungen> {
  const client = sb ?? createSupabaseAdmin()
  const { data } = await client
    .from('etsy_shop_einstellungen')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle()
  if (!data) return { ...DEFAULT_EINSTELLUNGEN, starSeller: {} }
  return {
    zielMargePct: Number(data.ziel_marge_pct) || DEFAULT_EINSTELLUNGEN.zielMargePct,
    etsyGebuehrPct: Number(data.etsy_gebuehr_pct) || DEFAULT_EINSTELLUNGEN.etsyGebuehrPct,
    paymentGebuehrPct: Number(data.payment_gebuehr_pct) || DEFAULT_EINSTELLUNGEN.paymentGebuehrPct,
    paymentGebuehrFix: Number(data.payment_gebuehr_fix) || DEFAULT_EINSTELLUNGEN.paymentGebuehrFix,
    kapazitaetProWoche: Number(data.kapazitaet_pro_woche) || DEFAULT_EINSTELLUNGEN.kapazitaetProWoche,
    starSeller: (data.star_seller as EtsyStarSellerCheck) || {},
  }
}

export async function speichereEtsyEinstellungen(
  ownerUserId: string,
  patch: Partial<EtsyShopEinstellungen>,
  sb: SupabaseClient,
): Promise<EtsyShopEinstellungen> {
  const aktuell = await ladeEtsyEinstellungen(ownerUserId, sb)
  const next: EtsyShopEinstellungen = {
    zielMargePct: patch.zielMargePct ?? aktuell.zielMargePct,
    etsyGebuehrPct: patch.etsyGebuehrPct ?? aktuell.etsyGebuehrPct,
    paymentGebuehrPct: patch.paymentGebuehrPct ?? aktuell.paymentGebuehrPct,
    paymentGebuehrFix: patch.paymentGebuehrFix ?? aktuell.paymentGebuehrFix,
    kapazitaetProWoche: patch.kapazitaetProWoche ?? aktuell.kapazitaetProWoche,
    starSeller: patch.starSeller ?? aktuell.starSeller,
  }
  const { error } = await sb.from('etsy_shop_einstellungen').upsert({
    owner_user_id: ownerUserId,
    ziel_marge_pct: next.zielMargePct,
    etsy_gebuehr_pct: next.etsyGebuehrPct,
    payment_gebuehr_pct: next.paymentGebuehrPct,
    payment_gebuehr_fix: next.paymentGebuehrFix,
    kapazitaet_pro_woche: next.kapazitaetProWoche,
    star_seller: next.starSeller,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  return next
}

export async function baueEtsyGeld(ownerUserId: string, sb: SupabaseClient): Promise<EtsyGeldErgebnis> {
  const einstellungen = await ladeEtsyEinstellungen(ownerUserId, sb)
  const [{ listings }, kostenRes, verkaufRes, vorlageRes] = await Promise.all([
    ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100 }),
    sb.from('etsy_produkt_kosten').select('*').eq('owner_user_id', ownerUserId),
    sb
      .from('etsy_listing_verkauf')
      .select('listing_id, menge, preis_eur, verkauft_at')
      .eq('owner_user_id', ownerUserId)
      .gte('verkauft_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    sb.from('etsy_kosten_vorlage').select('*').eq('owner_user_id', ownerUserId).order('name'),
  ])

  const kostenMap = new Map(
    (kostenRes.data ?? []).map((r) => [Number(r.listing_id), mapKosten(r as Record<string, unknown>)]),
  )

  const geldListings: EtsyGeldListing[] = listings.map((l) => {
    const kRaw = kostenMap.get(l.listingId) ?? null
    const k: EtsyKostenZeile | null = kRaw
      ? {
          holzEur: kRaw.holzEur,
          oelEur: kRaw.oelEur,
          schleifEur: kRaw.schleifEur,
          werkzeugEur: kRaw.werkzeugEur,
          stromEur: kRaw.stromEur,
          verpackungEur: kRaw.verpackungEur,
          sonstigesEur: kRaw.sonstigesEur,
          arbeitsstunden: kRaw.arbeitsstunden,
          stundensatzEur: kRaw.stundensatzEur,
          versandAnteilEur: kRaw.versandAnteilEur,
        }
      : null
    const zeile: EtsyKostenZeile = k ?? {
      holzEur: 0,
      oelEur: 0,
      schleifEur: 0,
      werkzeugEur: 0,
      stromEur: 0,
      verpackungEur: 0,
      sonstigesEur: 0,
      arbeitsstunden: 0,
      stundensatzEur: 0,
      versandAnteilEur: 0,
    }
    return {
      listingId: l.listingId,
      title: l.title,
      priceEur: l.priceEur,
      url: l.url,
      views: l.views ?? null,
      favoriten: l.numFavorers ?? null,
      kosten: k,
      marge: berechneMarge(l.priceEur, zeile, einstellungen),
    }
  })

  let umsatz30 = 0
  let gebuehren30 = 0
  let material30 = 0
  let verkaufe30 = 0
  for (const v of verkaufRes.data ?? []) {
    const preis = Number(v.preis_eur) || 0
    const menge = Math.max(1, Number(v.menge) || 1)
    umsatz30 += preis * menge
    verkaufe30 += menge
    const k = v.listing_id != null ? kostenMap.get(Number(v.listing_id)) : null
    if (k) {
      const m = berechneMarge(preis, k, einstellungen)
      material30 += m.variableEur * menge
      gebuehren30 += m.gebuehrenEur * menge
    } else {
      gebuehren30 +=
        (preis * (einstellungen.etsyGebuehrPct + einstellungen.paymentGebuehrPct)) / 100 +
        einstellungen.paymentGebuehrFix
    }
  }

  const verkaufByListing = new Map<number, string>()
  const { data: alleVerkaufe } = await sb
    .from('etsy_listing_verkauf')
    .select('listing_id, verkauft_at')
    .eq('owner_user_id', ownerUserId)
    .order('verkauft_at', { ascending: false })
    .limit(500)
  for (const v of alleVerkaufe ?? []) {
    if (v.listing_id == null) continue
    const id = Number(v.listing_id)
    if (!verkaufByListing.has(id)) verkaufByListing.set(id, String(v.verkauft_at))
  }

  const toteListings: EtsyGeldErgebnis['portfolio']['toteListings'] = []
  let aktiverWertEur = 0
  let listingsMitKosten = 0
  let listingsOhneKosten = 0
  const jetzt = Date.now()
  for (const l of geldListings) {
    if (l.priceEur != null) aktiverWertEur += l.priceEur
    if (l.kosten) listingsMitKosten++
    else listingsOhneKosten++
    const last = verkaufByListing.get(l.listingId)
    const tage = last ? Math.floor((jetzt - new Date(last).getTime()) / 86_400_000) : 999
    if ((l.views ?? 0) >= 20 && tage >= 90 && l.priceEur != null) {
      toteListings.push({
        listingId: l.listingId,
        title: l.title,
        priceEur: l.priceEur,
        tageOhneVerkauf: Math.min(tage, 999),
      })
    }
  }
  toteListings.sort((a, b) => b.priceEur - a.priceEur)

  return {
    einstellungen,
    listings: geldListings,
    pnl: {
      umsatz30: Math.round(umsatz30 * 100) / 100,
      gebuehren30: Math.round(gebuehren30 * 100) / 100,
      material30: Math.round(material30 * 100) / 100,
      netto30: Math.round((umsatz30 - gebuehren30 - material30) * 100) / 100,
      verkaufe30,
    },
    portfolio: {
      aktiverWertEur: Math.round(aktiverWertEur * 100) / 100,
      listingsMitKosten,
      listingsOhneKosten,
      toteKapitalEur: Math.round(toteListings.reduce((s, t) => s + t.priceEur, 0) * 100) / 100,
      toteListings: toteListings.slice(0, 12),
    },
    vorlagen: (vorlageRes.data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      holzart: r.holzart != null ? String(r.holzart) : null,
      kosten: {
        holzEur: Number(r.holz_eur) || 0,
        oelEur: Number(r.oel_eur) || 0,
        schleifEur: Number(r.schleif_eur) || 0,
        werkzeugEur: Number(r.werkzeug_eur) || 0,
        stromEur: Number(r.strom_eur) || 0,
        verpackungEur: Number(r.verpackung_eur) || 0,
        sonstigesEur: Number(r.sonstiges_eur) || 0,
        arbeitsstunden: Number(r.arbeitsstunden) || 0,
        stundensatzEur: Number(r.stundensatz_eur) || 0,
      },
    })),
  }
}

export async function speichereProduktKosten(
  ownerUserId: string,
  listingId: number,
  listingTitle: string,
  kosten: EtsyKostenZeile & { holzart?: string | null; notiz?: string },
  sb: SupabaseClient,
): Promise<void> {
  const { error } = await sb.from('etsy_produkt_kosten').upsert({
    owner_user_id: ownerUserId,
    listing_id: listingId,
    listing_title: listingTitle.slice(0, 200),
    holzart: kosten.holzart ?? null,
    holz_eur: kosten.holzEur,
    oel_eur: kosten.oelEur,
    schleif_eur: kosten.schleifEur,
    werkzeug_eur: kosten.werkzeugEur,
    strom_eur: kosten.stromEur,
    verpackung_eur: kosten.verpackungEur,
    sonstiges_eur: kosten.sonstigesEur,
    arbeitsstunden: kosten.arbeitsstunden,
    stundensatz_eur: kosten.stundensatzEur,
    versand_anteil_eur: kosten.versandAnteilEur ?? 0,
    notiz: kosten.notiz ?? '',
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function speichereKostenVorlage(
  ownerUserId: string,
  name: string,
  kosten: EtsyKostenZeile & { holzart?: string | null },
  sb: SupabaseClient,
): Promise<void> {
  const { error } = await sb.from('etsy_kosten_vorlage').upsert(
    {
      owner_user_id: ownerUserId,
      name: name.trim().slice(0, 80),
      holzart: kosten.holzart ?? null,
      holz_eur: kosten.holzEur,
      oel_eur: kosten.oelEur,
      schleif_eur: kosten.schleifEur,
      werkzeug_eur: kosten.werkzeugEur,
      strom_eur: kosten.stromEur,
      verpackung_eur: kosten.verpackungEur,
      sonstiges_eur: kosten.sonstigesEur,
      arbeitsstunden: kosten.arbeitsstunden,
      stundensatz_eur: kosten.stundensatzEur,
    },
    { onConflict: 'owner_user_id,name' },
  )
  if (error) throw new Error(error.message)
}

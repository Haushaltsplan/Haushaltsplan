/** Phase C+D: Saison-Board, Content, A/B, Reviews, Foto-Hinweise. */

import 'server-only'

import { ETSY_SAISONS, saisonStatus } from '@/lib/etsy/etsy-cockpit-regeln'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { berlinTag } from '@/lib/etsy/etsy-statistik-server'
import { ladeEtsyEinstellungen } from '@/lib/etsy/etsy-geld-server'
import type { EtsyWachstumErgebnis } from '@/lib/etsy/etsy-shop-os-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type { EtsyWachstumErgebnis } from '@/lib/etsy/etsy-shop-os-types'

export async function baueEtsyWachstum(ownerUserId: string, sb: SupabaseClient): Promise<EtsyWachstumErgebnis> {
  const heute = berlinTag()
  const { aktiv } = saisonStatus(heute)
  const einstellungen = await ladeEtsyEinstellungen(ownerUserId, sb)
  const [{ listings }, kampRes, contentRes, abRes, revRes, bestRes] = await Promise.all([
    ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100 }),
    sb.from('etsy_saison_kampagne').select('*').eq('owner_user_id', ownerUserId),
    sb.from('etsy_content_idee').select('*').eq('owner_user_id', ownerUserId).order('created_at', { ascending: false }).limit(30),
    sb.from('etsy_ab_test').select('*').eq('owner_user_id', ownerUserId).order('gestartet_at', { ascending: false }).limit(20),
    sb.from('etsy_review_notiz').select('*').eq('owner_user_id', ownerUserId).order('created_at', { ascending: false }).limit(40),
    sb
      .from('etsy_bestellung')
      .select('receipt_id, kaeufer_name, listing_title, gekauft_at, status')
      .eq('owner_user_id', ownerUserId)
      .in('status', ['versendet', 'erledigt'])
      .order('gekauft_at', { ascending: false })
      .limit(40),
  ])

  const ss = einstellungen.starSeller
  const starFlags = {
    antwortzeitOk: Boolean(ss.antwortzeitOk),
    versandfensterOk: Boolean(ss.versandfensterOk),
    caseRateOk: Boolean(ss.caseRateOk),
    bewertungenOk: Boolean(ss.bewertungenOk),
    notiz: String(ss.notiz || ''),
  }
  const starScore = [starFlags.antwortzeitOk, starFlags.versandfensterOk, starFlags.caseRateOk, starFlags.bewertungenOk].filter(
    Boolean,
  ).length

  const angefragt = new Set(
    (revRes.data ?? []).filter((r) => r.angefragt_at || r.erhalten_at).map((r) => Number(r.receipt_id)).filter(Boolean),
  )
  const jetzt = Date.now()
  const reviewAufgaben: EtsyWachstumErgebnis['reviewAufgaben'] = []
  for (const b of bestRes.data ?? []) {
    const rid = Number(b.receipt_id)
    if (angefragt.has(rid)) continue
    const ts = b.gekauft_at ? new Date(String(b.gekauft_at)).getTime() : NaN
    if (!Number.isFinite(ts)) continue
    const tage = Math.floor((jetzt - ts) / 86_400_000)
    if (tage >= 10 && tage <= 45) {
      reviewAufgaben.push({
        receiptId: rid,
        kaeuferName: String(b.kaeufer_name || ''),
        listingTitle: String(b.listing_title || ''),
        tageSeitKauf: tage,
      })
    }
  }

  const fotoHinweise: EtsyWachstumErgebnis['fotoHinweise'] = []
  for (const l of listings) {
    if ((l.numFavorers ?? 0) === 0 && (l.views ?? 0) >= 30) {
      fotoHinweise.push({
        listingId: l.listingId,
        title: l.title,
        hinweis: 'Viele Views, 0 Favoriten — Hauptbild/Maßstab/Lifestyle nachschießen',
      })
    }
  }

  const budgets = [50, 80, 120]
  const geschenkBudgets = budgets.map((budget) => ({
    budget,
    listings: listings
      .filter((l) => l.priceEur != null && l.priceEur >= budget * 0.7 && l.priceEur <= budget * 1.15)
      .slice(0, 6)
      .map((l) => ({ listingId: l.listingId, title: l.title, priceEur: l.priceEur as number })),
  }))

  return {
    saisonAktiv: aktiv.map((s) => ({ id: s.id, name: s.name, tag: s.tag })),
    kampagnen: (kampRes.data ?? []).map((r) => ({
      id: String(r.id),
      saisonId: String(r.saison_id),
      listingId: Number(r.listing_id),
      listingTitle: String(r.listing_title || ''),
      tagGeplant: Boolean(r.tag_geplant),
      giftFoto: Boolean(r.gift_foto),
      preisOk: Boolean(r.preis_ok),
      erledigt: Boolean(r.erledigt),
      notiz: String(r.notiz || ''),
    })),
    content: (contentRes.data ?? []).map((r) => ({
      id: String(r.id),
      listingId: r.listing_id != null ? Number(r.listing_id) : null,
      listingTitle: String(r.listing_title || ''),
      kanal: String(r.kanal || 'reel'),
      idee: String(r.idee || ''),
      geplantFuer: r.geplant_fuer != null ? String(r.geplant_fuer) : null,
      erledigt: Boolean(r.erledigt),
    })),
    abTests: (abRes.data ?? []).map((r) => ({
      id: String(r.id),
      listingId: Number(r.listing_id),
      listingTitle: String(r.listing_title || ''),
      variante: String(r.variante),
      aktiv: Boolean(r.aktiv),
      titel: r.titel != null ? String(r.titel) : null,
      gestartetAt: String(r.gestartet_at),
      notiz: String(r.notiz || ''),
    })),
    reviews: (revRes.data ?? []).map((r) => ({
      id: String(r.id),
      receiptId: r.receipt_id != null ? Number(r.receipt_id) : null,
      listingId: r.listing_id != null ? Number(r.listing_id) : null,
      kaeuferName: String(r.kaeufer_name || ''),
      sterne: r.sterne != null ? Number(r.sterne) : null,
      zitat: String(r.zitat || ''),
      angefragtAt: r.angefragt_at != null ? String(r.angefragt_at) : null,
      fuerListingNutzen: Boolean(r.fuer_listing_nutzen),
    })),
    reviewAufgaben: reviewAufgaben.slice(0, 12),
    starSeller: { ...starFlags, score: starScore },
    fotoHinweise: fotoHinweise.slice(0, 8),
    geschenkBudgets,
  }
}

export async function seedSaisonKampagne(
  ownerUserId: string,
  saisonId: string,
  sb: SupabaseClient,
): Promise<number> {
  const saison = ETSY_SAISONS.find((s) => s.id === saisonId)
  if (!saison) throw new Error('Unbekannte Saison')
  const { listings } = await ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100 })
  const rows = listings.map((l) => ({
    owner_user_id: ownerUserId,
    saison_id: saisonId,
    listing_id: l.listingId,
    listing_title: l.title.slice(0, 200),
    tag_geplant: true,
    gift_foto: false,
    preis_ok: true,
    erledigt: false,
  }))
  if (!rows.length) return 0
  const { error } = await sb.from('etsy_saison_kampagne').upsert(rows, {
    onConflict: 'owner_user_id,saison_id,listing_id',
  })
  if (error) throw new Error(error.message)
  return rows.length
}

export function contentIdeeAusListing(title: string): string {
  const kurz = title.replace(/\s+/g, ' ').trim().slice(0, 60)
  return `Reel: Nahaufnahme der Maserung → Schale in der Hand (Maßstab) → kurzer Satz „${kurz}“ → CTA „Unikat auf Etsy“.`
}

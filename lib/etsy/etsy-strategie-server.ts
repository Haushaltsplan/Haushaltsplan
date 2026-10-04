/** Phase G: CEO-Briefing, Kapazität, Rohholz, Algo-Rollback-Signale. */

import 'server-only'

import { baueEtsyGeld } from '@/lib/etsy/etsy-geld-server'
import { ladeEtsyEinstellungen } from '@/lib/etsy/etsy-geld-server'
import { baueEtsyZahlen } from '@/lib/etsy/etsy-zahlen-server'
import {
  berlinIsoWoche,
  type EtsyCeoBriefing,
  type EtsyRohholzStatus,
  type EtsyStrategieErgebnis,
} from '@/lib/etsy/etsy-shop-os-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type { EtsyCeoBriefing, EtsyStrategieErgebnis } from '@/lib/etsy/etsy-shop-os-types'

export async function baueCeoBriefing(ownerUserId: string, sb: SupabaseClient): Promise<EtsyCeoBriefing> {
  const [geld, zahlen, einstellungen, bestRes, wirkungRes] = await Promise.all([
    baueEtsyGeld(ownerUserId, sb),
    baueEtsyZahlen(ownerUserId, sb),
    ladeEtsyEinstellungen(ownerUserId, sb),
    sb
      .from('etsy_bestellung')
      .select('status')
      .eq('owner_user_id', ownerUserId)
      .in('status', ['neu', 'fertigung', 'verpacken']),
    sb
      .from('etsy_seo_aenderung')
      .select('listing_id, listing_title, created_at, beschreibung')
      .eq('owner_user_id', ownerUserId)
      .gte('created_at', new Date(Date.now() - 21 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const top = [...zahlen.listings].sort((a, b) => b.verkaufe30 - a.verkaufe30)[0] ?? null
  const flop =
    [...zahlen.listings]
      .filter((l) => l.views7 >= 15 && l.verkaufe30 === 0)
      .sort((a, b) => b.views7 - a.views7)[0] ?? null

  const offen = bestRes.data?.length ?? 0
  const kap = Math.max(1, einstellungen.kapazitaetProWoche)
  const auslastungPct = Math.round((offen / kap) * 100)

  const algoAlarme: EtsyCeoBriefing['algoAlarme'] = []
  for (const w of wirkungRes.data ?? []) {
    const lid = Number(w.listing_id)
    const funnel = zahlen.listings.find((l) => l.listingId === lid)
    if (!funnel) continue
    if (funnel.views7 === 0 || (funnel.viewToFavPct != null && funnel.viewToFavPct < 1)) {
      // weak signal after change
    }
  }
  for (const z of zahlen.zombies.slice(0, 3)) {
    const letzteAenderung = (wirkungRes.data ?? []).find((w) => Number(w.listing_id) === z.listingId)
    if (letzteAenderung) {
      algoAlarme.push({
        listingId: z.listingId,
        title: z.title,
        detail: `Views/Sales schwach nach SEO-Änderung (${String(letzteAenderung.beschreibung).slice(0, 60)}) — Rollback prüfen`,
      })
    }
  }

  return {
    woche: berlinIsoWoche(),
    umsatz30: geld.pnl.umsatz30,
    netto30: geld.pnl.netto30,
    verkaufe30: geld.pnl.verkaufe30,
    topListing: top
      ? { listingId: top.listingId, title: top.title, verkaufe30: top.verkaufe30 }
      : null,
    flopListing: flop ? { listingId: flop.listingId, title: flop.title, views7: flop.views7 } : null,
    aktionen: zahlen.entscheidungen.map((e) => ({
      titel: e.titel,
      detail: e.detail,
      listingId: e.listingId,
    })),
    konkurrenzHinweis: null,
    kapazitaet: {
      proWoche: kap,
      offeneBestellungen: offen,
      auslastungPct,
    },
    algoAlarme,
  }
}

export async function speichereCeoBriefing(ownerUserId: string, briefing: EtsyCeoBriefing): Promise<void> {
  const { error } = await createSupabaseAdmin().from('etsy_ceo_briefing').upsert({
    owner_user_id: ownerUserId,
    woche: briefing.woche,
    inhalt: briefing,
    created_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function baueEtsyStrategie(ownerUserId: string, sb: SupabaseClient): Promise<EtsyStrategieErgebnis> {
  const briefing = await baueCeoBriefing(ownerUserId, sb)
  await speichereCeoBriefing(ownerUserId, briefing).catch(() => undefined)

  const [rohRes, zahlen] = await Promise.all([
    sb.from('etsy_rohholz').select('*').eq('owner_user_id', ownerUserId).order('created_at', { ascending: false }).limit(40),
    baueEtsyZahlen(ownerUserId, sb),
  ])

  return {
    briefing,
    rohholz: (rohRes.data ?? []).map((r) => ({
      id: String(r.id),
      holzart: String(r.holzart),
      beschreibung: String(r.beschreibung || ''),
      status: r.status as EtsyRohholzStatus,
      kostenEur: r.kosten_eur != null ? Number(r.kosten_eur) : null,
      gekauftAt: r.gekauft_at != null ? String(r.gekauft_at) : null,
      bereitAt: r.bereit_at != null ? String(r.bereit_at) : null,
      listingId: r.listing_id != null ? Number(r.listing_id) : null,
      notiz: String(r.notiz || ''),
    })),
    killOrScale: zahlen.listings
      .filter((l) => l.killOrScale !== 'halten')
      .slice(0, 20)
      .map((l) => ({
        listingId: l.listingId,
        title: l.title,
        aktion: l.killOrScale,
        grund: l.grund,
        views7: l.views7,
        verkaufe30: l.verkaufe30,
      })),
  }
}

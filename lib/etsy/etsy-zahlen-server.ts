/** Phase E: Funnel, Zombies, Wochen-Entscheidungen, Kill-or-Scale-Signale. */

import 'server-only'

import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { ladeEtsyEinstellungen } from '@/lib/etsy/etsy-geld-server'
import {
  berechneMarge,
  type EtsyFunnelListing,
  type EtsyKillOrScale,
  type EtsyZahlenErgebnis,
} from '@/lib/etsy/etsy-shop-os-types'
import { berlinTag } from '@/lib/etsy/etsy-statistik-server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type { EtsyFunnelListing, EtsyZahlenErgebnis } from '@/lib/etsy/etsy-shop-os-types'

function pct(a: number, b: number): number | null {
  if (b <= 0) return null
  return Math.round((a / b) * 1000) / 10
}

function klassifiziere(opts: {
  views7: number
  favs7: number
  verkaufe30: number
  margePct: number | null
  zielMarge: number
  tageSeitVerkauf: number | null
}): { killOrScale: EtsyKillOrScale; grund: string } {
  const { views7, favs7, verkaufe30, margePct, zielMarge, tageSeitVerkauf } = opts
  const alt = tageSeitVerkauf == null || tageSeitVerkauf >= 90
  if (views7 >= 25 && verkaufe30 === 0 && alt) {
    return { killOrScale: 'pausieren', grund: 'Views da, kein Verkauf seit ≥90 Tagen — Preis/Fotos oder archivieren' }
  }
  if (views7 < 8 && verkaufe30 === 0) {
    return { killOrScale: 'nachschaerfen', grund: 'Kaum Sichtbarkeit — SEO/Tags/Hauptbegriff nachschärfen' }
  }
  if (margePct != null && margePct < zielMarge - 10 && verkaufe30 > 0) {
    return { killOrScale: 'premium', grund: 'Verkauft sich, aber Marge unter Ziel — Preis anheben' }
  }
  if (verkaufe30 >= 2 && (margePct == null || margePct >= zielMarge)) {
    return { killOrScale: 'skalieren', grund: 'Dreht gut — ähnliche Varianten / mehr Rohholz einplanen' }
  }
  if (favs7 >= 3 && verkaufe30 === 0) {
    return { killOrScale: 'nachschaerfen', grund: 'Favoriten ohne Kauf — Preis oder Vertrauenssignale prüfen' }
  }
  return { killOrScale: 'halten', grund: 'Im Rahmen — beobachten' }
}

export async function baueEtsyZahlen(ownerUserId: string, sb: SupabaseClient): Promise<EtsyZahlenErgebnis> {
  const einstellungen = await ladeEtsyEinstellungen(ownerUserId, sb)
  const heute = berlinTag()
  const vor7 = berlinTag(new Date(Date.now() - 7 * 86_400_000))
  const vor8 = berlinTag(new Date(Date.now() - 8 * 86_400_000))
  const vor14 = berlinTag(new Date(Date.now() - 14 * 86_400_000))

  const [{ listings }, statsRes, verkaufRes, kostenRes, auditRes] = await Promise.all([
    ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100 }),
    sb
      .from('etsy_listing_statistik')
      .select('listing_id, tag, views, favoriten')
      .eq('owner_user_id', ownerUserId)
      .gte('tag', vor14)
      .lte('tag', heute),
    sb
      .from('etsy_listing_verkauf')
      .select('listing_id, menge, verkauft_at')
      .eq('owner_user_id', ownerUserId)
      .gte('verkauft_at', new Date(Date.now() - 120 * 86_400_000).toISOString()),
    sb.from('etsy_produkt_kosten').select('*').eq('owner_user_id', ownerUserId),
    sb.from('etsy_seo_audit_cache').select('listing_id, overall_score').eq('owner_user_id', ownerUserId),
  ])

  type Snap = { views: number; favs: number }
  const byListing = new Map<number, Map<string, Snap>>()
  for (const s of statsRes.data ?? []) {
    const id = Number(s.listing_id)
    const tag = String(s.tag).slice(0, 10)
    if (!byListing.has(id)) byListing.set(id, new Map())
    byListing.get(id)!.set(tag, { views: Number(s.views) || 0, favs: Number(s.favoriten) || 0 })
  }

  function delta7(id: number, ende: string, start: string): { views: number; favs: number } {
    const m = byListing.get(id)
    if (!m) return { views: 0, favs: 0 }
    let endeSnap: { tag: string; snap: Snap } | null = null
    let startSnap: { tag: string; snap: Snap } | null = null
    for (const [tag, snap] of m) {
      if (tag <= ende && (!endeSnap || tag > endeSnap.tag)) endeSnap = { tag, snap }
      if (tag <= start && (!startSnap || tag > startSnap.tag)) startSnap = { tag, snap }
    }
    if (!endeSnap || !startSnap) return { views: 0, favs: 0 }
    return {
      views: Math.max(0, endeSnap.snap.views - startSnap.snap.views),
      favs: Math.max(0, endeSnap.snap.favs - startSnap.snap.favs),
    }
  }

  const verkaufe30By = new Map<number, number>()
  const letzterVerkauf = new Map<number, number>()
  const jetzt = Date.now()
  let verkaufe30Shop = 0
  for (const v of verkaufRes.data ?? []) {
    const id = v.listing_id != null ? Number(v.listing_id) : null
    const ts = new Date(String(v.verkauft_at)).getTime()
    const menge = Math.max(1, Number(v.menge) || 1)
    if (id != null) {
      if (!letzterVerkauf.has(id) || ts > (letzterVerkauf.get(id) ?? 0)) letzterVerkauf.set(id, ts)
      if (ts >= jetzt - 30 * 86_400_000) {
        verkaufe30By.set(id, (verkaufe30By.get(id) ?? 0) + menge)
        verkaufe30Shop += menge
      }
    }
  }

  const kostenMap = new Map((kostenRes.data ?? []).map((r) => [Number(r.listing_id), r]))
  const scoreMap = new Map(
    (auditRes.data ?? []).map((r) => [Number(r.listing_id), Number(r.overall_score)]),
  )

  let views7Shop = 0
  let favs7Shop = 0
  const funnelListings: EtsyFunnelListing[] = []

  for (const l of listings) {
    const d = delta7(l.listingId, heute, vor7)
    // fallback if sparse: try vor8 window end
    const d2 = d.views === 0 && d.favs === 0 ? delta7(l.listingId, vor8, vor14) : d
    const views7 = d2.views
    const favs7 = d2.favs
    views7Shop += views7
    favs7Shop += favs7
    const verkaufe30 = verkaufe30By.get(l.listingId) ?? 0
    const last = letzterVerkauf.get(l.listingId)
    const tageSeitVerkauf = last != null ? Math.floor((jetzt - last) / 86_400_000) : null
    const kRow = kostenMap.get(l.listingId)
    let margePct: number | null = null
    if (kRow) {
      const m = berechneMarge(
        l.priceEur,
        {
          holzEur: Number(kRow.holz_eur) || 0,
          oelEur: Number(kRow.oel_eur) || 0,
          schleifEur: Number(kRow.schleif_eur) || 0,
          werkzeugEur: Number(kRow.werkzeug_eur) || 0,
          stromEur: Number(kRow.strom_eur) || 0,
          verpackungEur: Number(kRow.verpackung_eur) || 0,
          sonstigesEur: Number(kRow.sonstiges_eur) || 0,
          arbeitsstunden: Number(kRow.arbeitsstunden) || 0,
          stundensatzEur: Number(kRow.stundensatz_eur) || 0,
          versandAnteilEur: Number(kRow.versand_anteil_eur) || 0,
        },
        einstellungen,
      )
      margePct = m.margePct
    }
    const { killOrScale, grund } = klassifiziere({
      views7,
      favs7,
      verkaufe30,
      margePct,
      zielMarge: einstellungen.zielMargePct,
      tageSeitVerkauf,
    })
    funnelListings.push({
      listingId: l.listingId,
      title: l.title,
      priceEur: l.priceEur,
      views7,
      favs7,
      verkaufe30,
      viewToFavPct: pct(favs7, views7),
      favToSalePct: pct(verkaufe30, Math.max(favs7, 1)),
      score: scoreMap.get(l.listingId) ?? null,
      tageSeitVerkauf,
      killOrScale,
      grund,
    })
  }

  const zombies = funnelListings
    .filter((l) => l.killOrScale === 'pausieren' || (l.views7 >= 20 && l.verkaufe30 === 0))
    .sort((a, b) => b.views7 - a.views7)
    .slice(0, 10)

  const entscheidungen: EtsyZahlenErgebnis['entscheidungen'] = []
  for (const z of zombies.slice(0, 2)) {
    entscheidungen.push({
      titel: `Zombie: ${z.title.slice(0, 40)}`,
      detail: z.grund,
      listingId: z.listingId,
      prio: 1,
    })
  }
  const skalieren = funnelListings.filter((l) => l.killOrScale === 'skalieren').slice(0, 1)
  for (const s of skalieren) {
    entscheidungen.push({
      titel: `Skalieren: ${s.title.slice(0, 40)}`,
      detail: s.grund,
      listingId: s.listingId,
      prio: 2,
    })
  }
  const nach = funnelListings.filter((l) => l.killOrScale === 'nachschaerfen').slice(0, 1)
  for (const n of nach) {
    entscheidungen.push({
      titel: `Nachschärfen: ${n.title.slice(0, 40)}`,
      detail: n.grund,
      listingId: n.listingId,
      prio: 3,
    })
  }
  if (entscheidungen.length < 3) {
    entscheidungen.push({
      titel: 'Kostenpflegen',
      detail: `${funnelListings.filter((l) => !kostenMap.has(l.listingId)).length} Listings ohne Stückkosten — Marge blind.`,
      prio: 4,
    })
  }
  entscheidungen.sort((a, b) => a.prio - b.prio)

  const rateProTag = verkaufe30Shop / 30
  const saisonBoost = (() => {
    const mm = heute.slice(5, 7)
    return mm === '10' || mm === '11' || mm === '12' ? 1.35 : 1
  })()

  return {
    funnelShop: {
      views7: views7Shop,
      favs7: favs7Shop,
      verkaufe30: verkaufe30Shop,
      viewToFavPct: pct(favs7Shop, views7Shop),
      favToSalePct: pct(verkaufe30Shop, Math.max(favs7Shop, 1)),
    },
    entscheidungen: entscheidungen.slice(0, 3),
    zombies,
    listings: funnelListings.sort((a, b) => b.views7 - a.views7),
    forecast: {
      verkaufe30: Math.round(rateProTag * 30 * saisonBoost * 10) / 10,
      verkaufe90: Math.round(rateProTag * 90 * saisonBoost * 10) / 10,
      hinweis:
        saisonBoost > 1
          ? 'Oktober–Dezember: Saison-Boost eingerechnet (+35 %).'
          : 'Linear aus den letzten 30 Tagen — ohne Saison-Boost.',
    },
  }
}

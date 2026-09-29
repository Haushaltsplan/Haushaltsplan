/**
 * Konkurrenz-Verkaufschart: die 10 größten deutschen Etsy-Shops für gedrechselte Schalen.
 *
 * Etsy veröffentlicht keine Verkäufe pro Listing, aber pro Shop den Lebenszeit-Zähler
 * `transaction_sold_count` (öffentlich, nur App-Key). Täglicher Snapshot →
 * Differenz = verkaufte Artikel im Zeitraum (ganzer Shop, nicht nur Schalen).
 *
 * Entdeckung (wöchentlich): DE-Suche über mehrere Schalen-Begriffe, Shops mit ≥2 Treffern
 * sind nischen-relevant; davon die 10 mit den meisten Verkäufen werden verfolgt.
 */

import 'server-only'

import { ETSY_API_BASE, etsyApiKeyHeader, etsyApiKonfiguriert } from '@/lib/etsy/etsy-types'
import type {
  EtsyKonkurrenzErgebnis,
  EtsyKonkurrenzShop,
  EtsyKonkurrenzVerlaufPunkt,
} from '@/lib/etsy/etsy-konkurrenz-types'
import { ETSY_KONKURRENZ_SHOP_LOCATION } from '@/lib/etsy/etsy-zielmarkt'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const KONKURRENZ_SUCHBEGRIFFE = [
  'gedrechselte schale',
  'holzschale gedrechselt',
  'handgedrehte holzschale',
  'drechselarbeit holz',
  'holzschale handgemacht',
  'obstschale holz',
  'holzschüssel gedrechselt',
]

const TOP_N = 10
const MIN_TREFFER = 2
const MAX_KANDIDATEN = 25
const SEITEN_PRO_BEGRIFF = 2
const ENTDECKUNG_ALLE_MS = 7 * 24 * 60 * 60 * 1000

type ApiListing = {
  shop_id?: number
  price?: { amount?: number; divisor?: number }
}

type ApiShop = {
  shop_id?: number
  shop_name?: string
  url?: string
  icon_url_fullxfull?: string | null
  transaction_sold_count?: number
  review_count?: number | null
  review_average?: number | null
  listing_active_count?: number
  num_favorers?: number
  shop_location_country_iso?: string | null
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

let letzterCall = 0
async function etsyGet<T>(pfad: string): Promise<T | null> {
  const warten = letzterCall + 150 - Date.now()
  if (warten > 0) await sleep(warten)
  letzterCall = Date.now()
  try {
    const res = await fetch(`${ETSY_API_BASE}${pfad}`, {
      headers: { 'x-api-key': etsyApiKeyHeader(), Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      console.warn('[etsy-konkurrenz]', res.status, pfad, (await res.text()).slice(0, 160))
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.warn('[etsy-konkurrenz]', pfad, e instanceof Error ? e.message : e)
    return null
  }
}

function berlinTag(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
}

function median(werte: number[]): number | null {
  if (!werte.length) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 100) / 100
}

async function holeShop(shopId: number): Promise<ApiShop | null> {
  return etsyGet<ApiShop>(`/application/shops/${shopId}`)
}

async function entdeckeShops(eigeneShopId: number | null) {
  const treffer = new Map<number, { anzahl: number; preise: number[] }>()
  for (const begriff of KONKURRENZ_SUCHBEGRIFFE) {
    for (let seite = 0; seite < SEITEN_PRO_BEGRIFF; seite++) {
      const q = new URLSearchParams({
        keywords: begriff,
        shop_location: ETSY_KONKURRENZ_SHOP_LOCATION,
        sort_on: 'score',
        limit: '100',
        offset: String(seite * 100),
      })
      const data = await etsyGet<{ results?: ApiListing[] }>(`/application/listings/active?${q}`)
      const results = data?.results ?? []
      for (const r of results) {
        const id = Number(r.shop_id)
        if (!Number.isFinite(id) || id <= 0) continue
        const e = treffer.get(id) ?? { anzahl: 0, preise: [] }
        e.anzahl++
        const betrag = Number(r.price?.amount)
        if (Number.isFinite(betrag)) e.preise.push(betrag / (Number(r.price?.divisor) || 100))
        treffer.set(id, e)
      }
      if (results.length < 100) break
    }
  }

  const kandidaten = [...treffer.entries()]
    .filter(([id, t]) => t.anzahl >= MIN_TREFFER && id !== eigeneShopId)
    .sort((a, b) => b[1].anzahl - a[1].anzahl)
    .slice(0, MAX_KANDIDATEN)

  const shops: Array<{ shop: ApiShop; treffer: number; preisMedian: number | null }> = []
  for (const [id, t] of kandidaten) {
    const shop = await holeShop(id)
    if (!shop?.shop_id) continue
    if (shop.shop_location_country_iso && shop.shop_location_country_iso !== 'DE') continue
    shops.push({ shop, treffer: t.anzahl, preisMedian: median(t.preise) })
  }
  shops.sort((a, b) => (b.shop.transaction_sold_count ?? 0) - (a.shop.transaction_sold_count ?? 0))
  return { top: shops.slice(0, TOP_N), treffer }
}

function shopZeile(ownerUserId: string, shop: ApiShop, extra: { treffer: number; preisMedian: number | null; eigener: boolean }) {
  return {
    owner_user_id: ownerUserId,
    shop_id: Number(shop.shop_id),
    shop_name: String(shop.shop_name || shop.shop_id),
    url: shop.url ?? null,
    icon_url: shop.icon_url_fullxfull ?? null,
    treffer: extra.treffer,
    preis_median: extra.preisMedian,
    eigener: extra.eigener,
    aktiv: true,
    entdeckt_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function snapshotZeile(ownerUserId: string, shop: ApiShop, tag: string) {
  return {
    owner_user_id: ownerUserId,
    shop_id: Number(shop.shop_id),
    tag,
    verkaeufe_gesamt: Math.max(0, Math.round(Number(shop.transaction_sold_count) || 0)),
    bewertungen: shop.review_count ?? null,
    bewertung_schnitt: shop.review_average != null ? Math.round(shop.review_average * 100) / 100 : null,
    aktive_listings: shop.listing_active_count ?? null,
    favoriten: shop.num_favorers ?? null,
  }
}

export type KonkurrenzLauf = {
  entdeckt: boolean
  shops: number
  snapshots: number
  fehler?: string
}

/**
 * Snapshot für einen Owner. Entdeckt die Top-Shops neu, wenn nie geschehen,
 * älter als 7 Tage oder `neuEntdecken` gesetzt ist.
 */
export async function aktualisiereEtsyKonkurrenz(
  ownerUserId: string,
  opts: { neuEntdecken?: boolean } = {},
): Promise<KonkurrenzLauf> {
  if (!etsyApiKonfiguriert()) return { entdeckt: false, shops: 0, snapshots: 0, fehler: 'Etsy-API nicht konfiguriert' }
  const sb = createSupabaseAdmin()
  const tag = berlinTag()

  const [{ data: tokenRow }, { data: bestand }] = await Promise.all([
    sb.from('etsy_oauth_tokens').select('shop_id').eq('owner_user_id', ownerUserId).maybeSingle(),
    sb
      .from('etsy_konkurrenz_shop')
      .select('shop_id, eigener, aktiv, entdeckt_at')
      .eq('owner_user_id', ownerUserId),
  ])
  const eigeneShopId = tokenRow?.shop_id != null ? Number(tokenRow.shop_id) : null

  const aktive = (bestand ?? []).filter((s) => s.aktiv && !s.eigener)
  const juengste = Math.max(0, ...aktive.map((s) => Date.parse(String(s.entdeckt_at)) || 0))
  const entdecken = opts.neuEntdecken || aktive.length === 0 || Date.now() - juengste > ENTDECKUNG_ALLE_MS

  const zeilen: ReturnType<typeof shopZeile>[] = []
  const snapshots: ReturnType<typeof snapshotZeile>[] = []

  if (entdecken) {
    const { top } = await entdeckeShops(eigeneShopId)
    if (top.length === 0) {
      return { entdeckt: false, shops: 0, snapshots: 0, fehler: 'Keine deutschen Schalen-Shops gefunden (Etsy-API?)' }
    }
    const jetzt = new Date().toISOString()
    for (const t of top) {
      zeilen.push(shopZeile(ownerUserId, t.shop, { ...t, eigener: false }))
      snapshots.push(snapshotZeile(ownerUserId, t.shop, tag))
    }
    const neueIds = new Set(top.map((t) => Number(t.shop.shop_id)))
    const rausgefallen = aktive.map((s) => Number(s.shop_id)).filter((id) => !neueIds.has(id))
    if (rausgefallen.length) {
      await sb
        .from('etsy_konkurrenz_shop')
        .update({ aktiv: false, updated_at: jetzt })
        .eq('owner_user_id', ownerUserId)
        .in('shop_id', rausgefallen)
    }
  } else {
    for (const s of aktive) {
      const shop = await holeShop(Number(s.shop_id))
      if (shop?.shop_id) snapshots.push(snapshotZeile(ownerUserId, shop, tag))
    }
  }

  if (eigeneShopId) {
    const eigen = await holeShop(eigeneShopId)
    if (eigen?.shop_id) {
      zeilen.push(shopZeile(ownerUserId, eigen, { treffer: 0, preisMedian: null, eigener: true }))
      snapshots.push(snapshotZeile(ownerUserId, eigen, tag))
    }
  }

  if (zeilen.length) {
    const { error } = await sb.from('etsy_konkurrenz_shop').upsert(zeilen, { onConflict: 'owner_user_id,shop_id' })
    if (error) throw new Error(`Konkurrenz-Shops speichern: ${error.message}`)
  }
  if (snapshots.length) {
    const { error } = await sb
      .from('etsy_konkurrenz_snapshot')
      .upsert(snapshots, { onConflict: 'owner_user_id,shop_id,tag' })
    if (error) throw new Error(`Konkurrenz-Snapshot speichern: ${error.message}`)
  }
  return { entdeckt: entdecken, shops: zeilen.length || snapshots.length, snapshots: snapshots.length }
}

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** Verkäufe seit `tage` Tagen: jüngster Wert minus letzter Snapshot am/vor Stichtag. */
function zuwachs(reihe: Array<{ tag: string; v: number }>, tage: number): number | null {
  if (reihe.length < 2) return null
  const letzter = reihe[reihe.length - 1]
  const stichtag = berlinTag(new Date(Date.parse(letzter.tag) - tage * 86_400_000))
  let basis: { tag: string; v: number } | null = null
  for (const p of reihe) {
    if (p.tag <= stichtag) basis = p
    else break
  }
  if (!basis) return null
  return Math.max(0, letzter.v - basis.v)
}

export async function ladeEtsyKonkurrenz(sb: SupabaseClient, tage = 90): Promise<EtsyKonkurrenzErgebnis> {
  const ab = berlinTag(new Date(Date.now() - tage * 86_400_000))
  const [{ data: shopRows, error: e1 }, { data: snapRows, error: e2 }] = await Promise.all([
    sb
      .from('etsy_konkurrenz_shop')
      .select('shop_id, shop_name, url, icon_url, treffer, preis_median, eigener, aktiv, entdeckt_at')
      .eq('aktiv', true),
    sb
      .from('etsy_konkurrenz_snapshot')
      .select('shop_id, tag, verkaeufe_gesamt, bewertungen, bewertung_schnitt, aktive_listings')
      .gte('tag', ab)
      .order('tag', { ascending: true })
      .limit(5000),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)

  const proShop = new Map<number, NonNullable<typeof snapRows>>()
  for (const r of snapRows ?? []) {
    const id = Number(r.shop_id)
    const liste = proShop.get(id) ?? []
    liste.push(r)
    proShop.set(id, liste)
  }

  const shops: EtsyKonkurrenzShop[] = (shopRows ?? []).map((s) => {
    const id = Number(s.shop_id)
    const snaps = proShop.get(id) ?? []
    const reihe = snaps.map((p) => ({ tag: String(p.tag), v: Number(p.verkaeufe_gesamt) }))
    const letzter = snaps[snaps.length - 1]
    const messTage = reihe.length >= 2 ? tageZwischen(reihe[0].tag, reihe[reihe.length - 1].tag) : 0
    return {
      shopId: id,
      name: String(s.shop_name),
      url: s.url ?? null,
      iconUrl: s.icon_url ?? null,
      treffer: Number(s.treffer) || 0,
      preisMedian: s.preis_median != null ? Number(s.preis_median) : null,
      eigener: Boolean(s.eigener),
      verkaeufeGesamt: letzter ? Number(letzter.verkaeufe_gesamt) : null,
      bewertungen: letzter?.bewertungen ?? null,
      bewertungSchnitt: letzter?.bewertung_schnitt != null ? Number(letzter.bewertung_schnitt) : null,
      aktiveListings: letzter?.aktive_listings ?? null,
      plus7: zuwachs(reihe, 7),
      plus30: zuwachs(reihe, 30),
      seitStart: messTage > 0 ? Math.max(0, reihe[reihe.length - 1].v - reihe[0].v) : null,
      proTag:
        messTage > 0
          ? Math.round(((reihe[reihe.length - 1].v - reihe[0].v) / messTage) * 10) / 10
          : null,
      messTage,
    }
  })
  shops.sort((a, b) => (b.verkaeufeGesamt ?? -1) - (a.verkaeufeGesamt ?? -1))

  const aktiveIds = new Set(shops.map((s) => s.shopId))
  const nachTag = new Map<string, EtsyKonkurrenzVerlaufPunkt>()
  for (const r of snapRows ?? []) {
    const id = Number(r.shop_id)
    if (!aktiveIds.has(id)) continue
    const t = String(r.tag)
    const punkt = nachTag.get(t) ?? ({ tag: t } as EtsyKonkurrenzVerlaufPunkt)
    punkt[String(id)] = Number(r.verkaeufe_gesamt)
    nachTag.set(t, punkt)
  }
  const verlauf = [...nachTag.values()].sort((a, b) => a.tag.localeCompare(b.tag))

  const entdeckt = (shopRows ?? []).map((s) => String(s.entdeckt_at)).sort()
  return {
    shops,
    verlauf,
    letzterSnapshot: verlauf.length ? verlauf[verlauf.length - 1].tag : null,
    entdecktAm: entdeckt.length ? entdeckt[entdeckt.length - 1] : null,
    suchbegriffe: KONKURRENZ_SUCHBEGRIFFE,
  }
}

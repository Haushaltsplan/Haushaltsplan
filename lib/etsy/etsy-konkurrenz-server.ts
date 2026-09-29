/**
 * Konkurrenz-Verkaufschart: die 10 größten deutschen Etsy-Shops, die überwiegend
 * gedrechselte Holzschalen verkaufen.
 *
 * Etsy veröffentlicht keine Verkäufe pro Listing, aber pro Shop den Lebenszeit-Zähler
 * `transaction_sold_count` (öffentlich, nur App-Key). Täglicher Snapshot →
 * Differenz = verkaufte Artikel im Zeitraum (ganzer Shop).
 *
 * Entdeckung (wöchentlich):
 * 1) DE-Suche über Schalen-Begriffe → Kandidaten-Shops
 * 2) Sortiment jedes Kandidaten prüfen: Anteil Holzschalen ≥ 40 % (Deko-/Epoxid-/Gemischtshops fliegen raus)
 * 3) Top 10 nach Verkäufen; manuell hinzugefügte Shops sind immer dabei, ausgeschlossene nie.
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
  'holzschüssel gedrechselt',
  'drechselarbeit',
  'holzschale unikat',
  'holzschale nussbaum',
  'holzschale eiche',
  'wurzelholz schale',
  'obstschale holz',
  'holzschale',
]

const TOP_N = 10
const MAX_KANDIDATEN = 45
const SEITEN_PRO_BEGRIFF = 3
const MIN_SCHALEN_ANTEIL = 0.4
const MIN_LISTINGS = 3
const PARALLEL = 5
const ENTDECKUNG_ALLE_MS = 7 * 24 * 60 * 60 * 1000

const SCHALE_RE = /(schale|schälchen|schaelchen|schüssel|schuessel|\bbowls?\b)/
const HOLZ_RE =
  /(holz|wood|gedrechselt|handgedreht|gedreht|drechsel|turned|eiche|buche|nuss|ahorn|esche|kirsch|olive|birke|erle|linde|ulme|zwetschg|pflaume|apfel|birn|robinie|akazie|zirbe|platane|walnut|oak|maple|cherry)/
/** Titel mit diesen Materialien/Produkten zählen nicht als gedrechselte Holzschale. */
const NICHT_GEDRECHSELT_RE =
  /(epoxid|resin|\bharz|beton|keramik|\bton\b|porzellan|steingut|glas|silikon|gie(ß|ss)form|kunststoff|metall|messing|kupfer|filz|häkel|makramee|kerze|seife|papier|leder|stoff|textil|brandmalerei|lasergravur|laser)/

type ApiListing = {
  shop_id?: number
  title?: string
  tags?: string[]
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

type Fokus = { anteil: number; stichprobe: number; preisMedian: number | null }

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Startabstand ≥150 ms zwischen Calls (Etsy: 10 req/s), Anfragen dürfen sich überlappen. */
let naechsterSlot = 0
async function etsyGet<T>(pfad: string): Promise<T | null> {
  const jetzt = Date.now()
  naechsterSlot = Math.max(jetzt, naechsterSlot) + 150
  const warten = naechsterSlot - 150 - jetzt
  if (warten > 0) await sleep(warten)
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

async function inGruppen<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += PARALLEL) {
    out.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(fn))))
  }
  return out
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

function preisEur(p: ApiListing['price']): number | null {
  const betrag = Number(p?.amount)
  return Number.isFinite(betrag) ? betrag / (Number(p?.divisor) || 100) : null
}

export function istGedrechselteHolzschale(title: string, tags: string[] = []): boolean {
  const t = title.toLowerCase()
  if (NICHT_GEDRECHSELT_RE.test(t)) return false
  if (!SCHALE_RE.test(t)) return false
  return HOLZ_RE.test(`${t} ${tags.join(' ').toLowerCase()}`)
}

async function holeShop(shopId: number): Promise<ApiShop | null> {
  return etsyGet<ApiShop>(`/application/shops/${shopId}`)
}

/** Sortiment-Check: welcher Anteil der aktiven Listings sind gedrechselte Holzschalen? */
async function pruefeFokus(shopId: number): Promise<Fokus | null> {
  const data = await etsyGet<{ count?: number; results?: ApiListing[] }>(
    `/application/shops/${shopId}/listings/active?limit=100`,
  )
  const listings = data?.results ?? []
  if (!listings.length) return null
  const schalen = listings.filter((l) => istGedrechselteHolzschale(String(l.title || ''), l.tags ?? []))
  return {
    anteil: Math.round((schalen.length / listings.length) * 1000) / 1000,
    stichprobe: listings.length,
    preisMedian: median(schalen.map((l) => preisEur(l.price)).filter((p): p is number => p != null)),
  }
}

async function sammleKandidaten(): Promise<Map<number, number>> {
  const treffer = new Map<number, number>()
  const abfragen = KONKURRENZ_SUCHBEGRIFFE.flatMap((begriff) =>
    Array.from({ length: SEITEN_PRO_BEGRIFF }, (_, seite) => ({ begriff, seite })),
  )
  const ergebnisse = await inGruppen(abfragen, ({ begriff, seite }) => {
    const q = new URLSearchParams({
      keywords: begriff,
      shop_location: ETSY_KONKURRENZ_SHOP_LOCATION,
      sort_on: 'score',
      limit: '100',
      offset: String(seite * 100),
    })
    return etsyGet<{ results?: ApiListing[] }>(`/application/listings/active?${q}`)
  })
  for (const data of ergebnisse) {
    for (const r of data?.results ?? []) {
      const id = Number(r.shop_id)
      if (!Number.isFinite(id) || id <= 0) continue
      // Nur Treffer zählen, die selbst gedrechselte Holzschalen sind.
      if (!istGedrechselteHolzschale(String(r.title || ''), r.tags ?? [])) continue
      treffer.set(id, (treffer.get(id) ?? 0) + 1)
    }
  }
  return treffer
}

type Bewertet = { shop: ApiShop; treffer: number; fokus: Fokus }

async function entdeckeShops(ausschliessen: Set<number>, anzahl: number): Promise<Bewertet[]> {
  if (anzahl <= 0) return []
  const treffer = await sammleKandidaten()
  const kandidaten = [...treffer.entries()]
    .filter(([id]) => !ausschliessen.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KANDIDATEN)

  const geprueft = await inGruppen(kandidaten, async ([id, t]) => {
    const fokus = await pruefeFokus(id)
    if (!fokus || fokus.stichprobe < MIN_LISTINGS || fokus.anteil < MIN_SCHALEN_ANTEIL) return null
    const shop = await holeShop(id)
    if (!shop?.shop_id) return null
    if (shop.shop_location_country_iso && shop.shop_location_country_iso !== 'DE') return null
    return { shop, treffer: t, fokus } satisfies Bewertet
  })
  return geprueft
    .filter((g): g is Bewertet => g != null)
    .sort((a, b) => (b.shop.transaction_sold_count ?? 0) - (a.shop.transaction_sold_count ?? 0))
    .slice(0, anzahl)
}

function shopZeile(
  ownerUserId: string,
  shop: ApiShop,
  extra: { treffer: number; fokus: Fokus | null; eigener: boolean; manuell: boolean },
) {
  const jetzt = new Date().toISOString()
  return {
    owner_user_id: ownerUserId,
    shop_id: Number(shop.shop_id),
    shop_name: String(shop.shop_name || shop.shop_id),
    url: shop.url ?? null,
    icon_url: shop.icon_url_fullxfull ?? null,
    treffer: extra.treffer,
    preis_median: extra.fokus?.preisMedian ?? null,
    schalen_anteil: extra.fokus?.anteil ?? null,
    eigener: extra.eigener,
    manuell: extra.manuell,
    ausgeschlossen: false,
    aktiv: true,
    entdeckt_at: jetzt,
    updated_at: jetzt,
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

type BestandRow = {
  shop_id: number
  eigener: boolean
  aktiv: boolean
  manuell: boolean
  ausgeschlossen: boolean
  entdeckt_at: string
  treffer: number
}

async function speichere(sb: SupabaseClient, zeilen: ReturnType<typeof shopZeile>[], snapshots: ReturnType<typeof snapshotZeile>[]) {
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

  const [{ data: tokenRow }, { data: bestandRaw }] = await Promise.all([
    sb.from('etsy_oauth_tokens').select('shop_id').eq('owner_user_id', ownerUserId).maybeSingle(),
    sb
      .from('etsy_konkurrenz_shop')
      .select('shop_id, eigener, aktiv, manuell, ausgeschlossen, entdeckt_at, treffer')
      .eq('owner_user_id', ownerUserId),
  ])
  const bestand = (bestandRaw ?? []) as BestandRow[]
  const eigeneShopId = tokenRow?.shop_id != null ? Number(tokenRow.shop_id) : null

  const manuelle = bestand.filter((s) => s.manuell && !s.ausgeschlossen)
  const auto = bestand.filter((s) => s.aktiv && !s.eigener && !s.manuell)
  const juengste = Math.max(0, ...auto.map((s) => Date.parse(String(s.entdeckt_at)) || 0))
  const entdecken = opts.neuEntdecken || auto.length === 0 || Date.now() - juengste > ENTDECKUNG_ALLE_MS

  const zeilen: ReturnType<typeof shopZeile>[] = []
  const snapshots: ReturnType<typeof snapshotZeile>[] = []

  if (entdecken) {
    const ausschliessen = new Set<number>([
      ...bestand.filter((s) => s.ausgeschlossen || s.manuell).map((s) => Number(s.shop_id)),
      ...(eigeneShopId ? [eigeneShopId] : []),
    ])
    const top = await entdeckeShops(ausschliessen, Math.max(0, TOP_N - manuelle.length))
    if (top.length === 0 && manuelle.length === 0) {
      return {
        entdeckt: false,
        shops: 0,
        snapshots: 0,
        fehler: 'Keine deutschen Shops mit Schwerpunkt Holzschalen gefunden — füge Shops manuell hinzu.',
      }
    }
    for (const t of top) {
      zeilen.push(shopZeile(ownerUserId, t.shop, { treffer: t.treffer, fokus: t.fokus, eigener: false, manuell: false }))
      snapshots.push(snapshotZeile(ownerUserId, t.shop, tag))
    }
    const neueIds = new Set(top.map((t) => Number(t.shop.shop_id)))
    const rausgefallen = auto.map((s) => Number(s.shop_id)).filter((id) => !neueIds.has(id))
    if (rausgefallen.length) {
      await sb
        .from('etsy_konkurrenz_shop')
        .update({ aktiv: false, updated_at: new Date().toISOString() })
        .eq('owner_user_id', ownerUserId)
        .in('shop_id', rausgefallen)
    }
  } else {
    const shops = await inGruppen(auto, (s) => holeShop(Number(s.shop_id)))
    for (const shop of shops) if (shop?.shop_id) snapshots.push(snapshotZeile(ownerUserId, shop, tag))
  }

  const manuellShops = await inGruppen(manuelle, (s) => holeShop(Number(s.shop_id)))
  for (const shop of manuellShops) if (shop?.shop_id) snapshots.push(snapshotZeile(ownerUserId, shop, tag))

  if (eigeneShopId) {
    const [eigen, fokus] = await Promise.all([holeShop(eigeneShopId), entdecken ? pruefeFokus(eigeneShopId) : null])
    if (eigen?.shop_id) {
      if (entdecken || !bestand.some((s) => s.eigener)) {
        zeilen.push(shopZeile(ownerUserId, eigen, { treffer: 0, fokus, eigener: true, manuell: false }))
      }
      snapshots.push(snapshotZeile(ownerUserId, eigen, tag))
    }
  }

  await speichere(sb, zeilen, snapshots)
  return { entdeckt: entdecken, shops: zeilen.length || snapshots.length, snapshots: snapshots.length }
}

/** Shop per Namen (z. B. „JoergZube“ oder Etsy-Shop-URL) dauerhaft in den Chart aufnehmen. */
export async function fuegeEtsyKonkurrenzShopHinzu(
  ownerUserId: string,
  eingabe: string,
): Promise<{ ok: true; name: string } | { ok: false; fehler: string }> {
  if (!etsyApiKonfiguriert()) return { ok: false, fehler: 'Etsy-API nicht konfiguriert' }
  const name = eingabe
    .trim()
    .replace(/^https?:\/\/(www\.)?etsy\.com\/([a-z]{2}(-[a-z]{2})?\/)?shop\//i, '')
    .replace(/[/?#].*$/, '')
    .trim()
  if (!/^[A-Za-z0-9]{2,40}$/.test(name)) return { ok: false, fehler: 'Bitte den Etsy-Shopnamen eingeben (nur Buchstaben/Zahlen).' }

  const suche = await etsyGet<{ results?: ApiShop[] }>(
    `/application/shops?${new URLSearchParams({ shop_name: name, limit: '25' })}`,
  )
  const treffer = suche?.results ?? []
  const shopKurz = treffer.find((s) => String(s.shop_name).toLowerCase() === name.toLowerCase())
  if (!shopKurz?.shop_id) return { ok: false, fehler: `Shop „${name}“ nicht gefunden.` }

  const [shop, fokus] = await Promise.all([holeShop(Number(shopKurz.shop_id)), pruefeFokus(Number(shopKurz.shop_id))])
  if (!shop?.shop_id) return { ok: false, fehler: 'Shop-Daten konnten nicht geladen werden.' }

  await speichere(
    createSupabaseAdmin(),
    [shopZeile(ownerUserId, shop, { treffer: 0, fokus, eigener: false, manuell: true })],
    [snapshotZeile(ownerUserId, shop, berlinTag())],
  )
  return { ok: true, name: String(shop.shop_name) }
}

/** Shop aus dem Chart nehmen und bei künftigen Entdeckungen überspringen. */
export async function entferneEtsyKonkurrenzShop(ownerUserId: string, shopId: number): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from('etsy_konkurrenz_shop')
    .update({ aktiv: false, manuell: false, ausgeschlossen: true, updated_at: new Date().toISOString() })
    .eq('owner_user_id', ownerUserId)
    .eq('shop_id', shopId)
    .eq('eigener', false)
  if (error) throw new Error(error.message)
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
      .select('shop_id, shop_name, url, icon_url, treffer, preis_median, schalen_anteil, eigener, manuell, aktiv, entdeckt_at')
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
      schalenAnteil: s.schalen_anteil != null ? Number(s.schalen_anteil) : null,
      eigener: Boolean(s.eigener),
      manuell: Boolean(s.manuell),
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
    minSchalenAnteil: MIN_SCHALEN_ANTEIL,
  }
}

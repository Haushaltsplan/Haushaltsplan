/**
 * Stellt 13 Etsy-Tags je Listing wieder her, nachdem ein Update nur den letzten Tag
 * gespeichert hat (mehrfaches append('tags') statt komma-getrennter Liste).
 *
 * Quellen in dieser Reihenfolge: Änderungs-Log / KI-Vorschlag / Entwurfshistorie,
 * dann Nachhärtung aus Titel, Holzart, Hauptbegriff und gemerkten Keywords.
 */

import 'server-only'

import { erkenneHolzGruppen, nenntFremdeHolzart } from '@/lib/etsy/etsy-zielmarkt'
import { sanitisiereEtsyTag } from '@/lib/etsy/etsy-listing-attrs'
import {
  ladeEtsyListingDetail,
  ladeEtsyShopListings,
  updateEtsyListing,
} from '@/lib/etsy/etsy-listings-server'
import { ladeEtsyHauptbegriffe } from '@/lib/etsy/etsy-seo-audit-cache'
import { ETSY_SEO_TAG_COUNT, haerteEtsyListingFuerScore } from '@/lib/etsy/etsy-seo-regeln'
import { protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type EtsyTagQuelle = 'historie' | 'vorschlag' | 'entwurf' | 'haertung'

export type EtsyTagReparaturZeile = {
  listingId: number
  title: string
  vorher: number
  nachher: number
  quelle: EtsyTagQuelle
  ok: boolean
  fehler?: string
  tags: string[]
}

export type EtsyTagReparaturErgebnis = {
  betroffen: number
  repariert: number
  fehlgeschlagen: number
  bereitsVoll: number
  ergebnisse: EtsyTagReparaturZeile[]
}

const HOLZ_LABEL: Record<string, string> = {
  eiche: 'Eiche',
  esche: 'Esche',
  ahorn: 'Ahorn',
  nuss: 'Nussbaum',
  kirsch: 'Kirsche',
  birke: 'Birke',
  buche: 'Buche',
  ulme: 'Ulme',
  eibe: 'Eibe',
  olive: 'Olive',
  akazie: 'Akazie',
  teak: 'Teak',
  mango: 'Mango',
  bambus: 'Bambus',
  kiefer: 'Kiefer',
  zirbe: 'Zirbe',
  laerche: 'Lärche',
  fichte: 'Fichte',
  linde: 'Linde',
  pflaume: 'Pflaume',
  apfel: 'Apfel',
  birne: 'Birne',
  robinie: 'Robinie',
  kastanie: 'Kastanie',
  platane: 'Platane',
  palisander: 'Palisander',
  ebenholz: 'Ebenholz',
}

function uniqueTags(raw: unknown): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const liste = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : []
  for (const x of liste) {
    const t = sanitisiereEtsyTag(String(x))
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
    if (out.length >= ETSY_SEO_TAG_COUNT) break
  }
  return out
}

function tagsAusJson(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as { tags?: unknown }
  return uniqueTags(o.tags)
}

export function waehleBesteTagListe(
  kandidaten: Array<{ tags: string[]; quelle: EtsyTagQuelle }>,
): { tags: string[]; quelle: EtsyTagQuelle } | null {
  let best: { tags: string[]; quelle: EtsyTagQuelle } | null = null
  for (const k of kandidaten) {
    const tags = uniqueTags(k.tags)
    if (tags.length < 4) continue
    if (!best || tags.length > best.tags.length) best = { tags, quelle: k.quelle }
  }
  return best
}

function holzartFuerListing(title: string, materials: string[], historieHolz?: string | null): string {
  const hist = historieHolz?.trim()
  if (hist) return hist.slice(0, 40)
  const mat = materials.map((m) => m.trim()).find((m) => m.length >= 3)
  if (mat && /holz|eiche|esche|ahorn|nuss|kirsch|birke|buche|ulme|eibe|olive/i.test(mat)) return mat.slice(0, 40)
  const id = [...erkenneHolzGruppen(title)][0]
  return id && HOLZ_LABEL[id] ? HOLZ_LABEL[id] : mat ? mat.slice(0, 40) : ''
}

function produktFormFuerTitel(title: string): string {
  const m = title.match(/(schüssel|schuessel|schale|dose|vase|teller|stab|skulptur)/i)
  if (!m) return 'Schale'
  const x = m[1]!.toLowerCase()
  if (x.startsWith('schüss') || x.startsWith('schuess')) return 'Schüssel'
  if (x.startsWith('dose')) return 'Dose'
  if (x.startsWith('vase')) return 'Vase'
  if (x.startsWith('teller')) return 'Teller'
  if (x.startsWith('stab')) return 'Stab'
  if (x.startsWith('skulptur')) return 'Skulptur'
  return 'Schale'
}

function merklistePassend(keyword: string, title: string, holzart: string, tags: string[]): boolean {
  const tag = sanitisiereEtsyTag(keyword)
  if (!tag || tag.length < 4) return false
  const blob = `${title} ${holzart} ${tags.join(' ')}`
  if (nenntFremdeHolzart(tag, erkenneHolzGruppen(blob))) return false
  const n = tag.toLowerCase()
  if (tags.some((t) => t.toLowerCase() === n)) return false
  const holz = holzart.toLowerCase()
  if (holz && n.includes(holz.slice(0, 5))) return true
  const worte = n.split(/\s+/).filter((w) => w.length >= 4)
  const low = blob.toLowerCase()
  return worte.some((w) => low.includes(w))
}

async function ladeAktiveListingsKurz(ownerUserId: string) {
  const out: Array<{ listingId: number; title: string; tags: string[] }> = []
  for (let offset = 0; offset < 400; offset += 100) {
    const { listings } = await ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100, offset })
    for (const l of listings) out.push({ listingId: l.listingId, title: l.title, tags: l.tags ?? [] })
    if (listings.length < 100) break
  }
  return out
}

type HistMap = Map<number, Array<{ tags: string[]; quelle: EtsyTagQuelle }>>

async function ladeTagQuellen(ownerUserId: string, ids: number[]): Promise<{
  kandidaten: HistMap
  holzHistorie: Map<number, string>
}> {
  const kandidaten: HistMap = new Map()
  const holzHistorie = new Map<number, string>()
  if (!ids.length) return { kandidaten, holzHistorie }
  const push = (listingId: number, tags: string[], quelle: EtsyTagQuelle) => {
    if (tags.length < 4) return
    const list = kandidaten.get(listingId) ?? []
    list.push({ tags, quelle })
    kandidaten.set(listingId, list)
  }
  const sb = createSupabaseAdmin()

  const aend = await sb
    .from('etsy_seo_aenderung')
    .select('listing_id, before_json, after_json')
    .eq('owner_user_id', ownerUserId)
    .in('listing_id', ids)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (!aend.error) {
    for (const r of aend.data ?? []) {
      const id = Number(r.listing_id)
      push(id, tagsAusJson(r.after_json), 'historie')
      push(id, tagsAusJson(r.before_json), 'historie')
    }
  }

  const vorsch = await sb
    .from('etsy_seo_vorschlag')
    .select('listing_id, before_json, after_json')
    .eq('owner_user_id', ownerUserId)
    .in('listing_id', ids)
    .limit(500)
  if (!vorsch.error) {
    for (const r of vorsch.data ?? []) {
      const id = Number(r.listing_id)
      push(id, tagsAusJson(r.after_json), 'vorschlag')
      push(id, tagsAusJson(r.before_json), 'vorschlag')
    }
  }

  const draft = await sb
    .from('etsy_draft_historie')
    .select('listing_id, tags, holzart')
    .eq('owner_user_id', ownerUserId)
    .in('listing_id', ids)
    .order('created_at', { ascending: false })
    .limit(500)
  if (!draft.error) {
    for (const r of draft.data ?? []) {
      const id = Number(r.listing_id)
      push(id, uniqueTags(r.tags), 'entwurf')
      const holz = r.holzart != null ? String(r.holzart).trim() : ''
      if (holz && !holzHistorie.has(id)) holzHistorie.set(id, holz)
    }
  }

  return { kandidaten, holzHistorie }
}

function baueDreizehn(opts: {
  title: string
  current: string[]
  history: string[]
  holzart: string
  description: string
  hauptbegriff?: string
  merkliste: string[]
}): { tags: string[]; quelle: EtsyTagQuelle } {
  const seeds = uniqueTags([
    ...opts.history,
    ...opts.current,
    ...(opts.hauptbegriff ? [opts.hauptbegriff] : []),
    ...opts.merkliste.filter((k) => merklistePassend(k, opts.title, opts.holzart, opts.history.length ? opts.history : opts.current)),
  ])
  const tags = haerteEtsyListingFuerScore({
    title: opts.title,
    tags: seeds,
    description: opts.description,
    holzart: opts.holzart || undefined,
    produktForm: produktFormFuerTitel(opts.title),
  }).tags
  const quelle: EtsyTagQuelle = opts.history.length >= 8 ? 'historie' : seeds.length >= 8 ? 'vorschlag' : 'haertung'
  return { tags, quelle }
}

async function pause(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function zaehleUnvollstaendigeEtsyTags(ownerUserId: string): Promise<{
  betroffen: number
  bereitsVoll: number
  listings: Array<{ listingId: number; title: string; tags: number }>
}> {
  const alle = await ladeAktiveListingsKurz(ownerUserId)
  const unvoll = alle.filter((l) => l.tags.length !== ETSY_SEO_TAG_COUNT)
  return {
    betroffen: unvoll.length,
    bereitsVoll: alle.length - unvoll.length,
    listings: unvoll.map((l) => ({ listingId: l.listingId, title: l.title, tags: l.tags.length })),
  }
}

export async function repariereEtsyShopTags(
  ownerUserId: string,
  opts?: { dryRun?: boolean; listingIds?: number[] },
): Promise<EtsyTagReparaturErgebnis> {
  const alle = await ladeAktiveListingsKurz(ownerUserId)
  const ziel = opts?.listingIds?.length
    ? alle.filter((l) => opts.listingIds!.includes(l.listingId))
    : alle
  const bereitsVoll = ziel.filter((l) => l.tags.length === ETSY_SEO_TAG_COUNT).length
  const betroffen = ziel.filter((l) => l.tags.length !== ETSY_SEO_TAG_COUNT)
  const ergebnisse: EtsyTagReparaturZeile[] = []

  const ids = betroffen.map((l) => l.listingId)
  const [{ kandidaten, holzHistorie }, hauptbegriffe, merkRes] = await Promise.all([
    ladeTagQuellen(ownerUserId, ids),
    ladeEtsyHauptbegriffe(ownerUserId).catch(() => new Map<number, string>()),
    createSupabaseAdmin()
      .from('etsy_keyword_merkliste')
      .select('keyword')
      .eq('owner_user_id', ownerUserId),
  ])
  const merkliste = (merkRes.data ?? []).map((m) => String(m.keyword)).filter(Boolean)

  for (const kurz of betroffen) {
    try {
      const { listing } = await ladeEtsyListingDetail(ownerUserId, kurz.listingId)
      const best = waehleBesteTagListe(kandidaten.get(kurz.listingId) ?? [])
      const gebaut = baueDreizehn({
        title: listing.title,
        current: listing.tags,
        history: best?.tags ?? [],
        holzart: holzartFuerListing(listing.title, listing.materials, holzHistorie.get(listing.listingId)),
        description: listing.description,
        hauptbegriff: hauptbegriffe.get(listing.listingId),
        merkliste,
      })
      const quelle = best?.quelle ?? gebaut.quelle
      if (opts?.dryRun) {
        ergebnisse.push({
          listingId: listing.listingId,
          title: listing.title,
          vorher: listing.tags.length,
          nachher: gebaut.tags.length,
          quelle,
          ok: gebaut.tags.length === ETSY_SEO_TAG_COUNT,
          tags: gebaut.tags,
        })
        continue
      }
      const neu = await updateEtsyListing(ownerUserId, listing.listingId, { tags: gebaut.tags })
      await protokolliereEtsyAenderung({
        ownerUserId,
        listingId: listing.listingId,
        listingTitle: listing.title,
        quelle: 'aufgabe',
        beschreibung: `Tags-Reparatur: ${listing.tags.length} → ${neu.tags.length} (${quelle})`,
        before: { tags: listing.tags },
        after: { tags: neu.tags },
      })
      ergebnisse.push({
        listingId: listing.listingId,
        title: listing.title,
        vorher: listing.tags.length,
        nachher: neu.tags.length,
        quelle,
        ok: neu.tags.length === ETSY_SEO_TAG_COUNT,
        tags: neu.tags,
      })
      await pause(280)
    } catch (e) {
      ergebnisse.push({
        listingId: kurz.listingId,
        title: kurz.title,
        vorher: kurz.tags.length,
        nachher: kurz.tags.length,
        quelle: 'haertung',
        ok: false,
        fehler: e instanceof Error ? e.message.slice(0, 200) : 'Fehler',
        tags: kurz.tags,
      })
    }
  }

  return {
    betroffen: betroffen.length,
    repariert: ergebnisse.filter((e) => e.ok).length,
    fehlgeschlagen: ergebnisse.filter((e) => !e.ok).length,
    bereitsVoll,
    ergebnisse,
  }
}

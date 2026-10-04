/**
 * Etsy-Cockpit: lädt alle Quellen (Listings, Messung, Verkäufe, Audit, Ranking,
 * Merkliste, Konkurrenz), baut daraus Aufgaben + KPIs + Wirkung und führt Aktionen aus.
 */

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  baueCockpitAufgaben,
  bewerteWirkung,
  normTag,
  passendeListings,
  planeTagTausch,
  saisonStatus,
  tagMinus,
  waehleErsatzTag,
  wendeTagTauschAn,
  zuwachsImFenster,
  type CockpitListing,
  type StatPunkt,
} from '@/lib/etsy/etsy-cockpit-regeln'
import type {
  EtsyCockpitErgebnis,
  EtsyCockpitKpis,
  EtsyTagTausch,
  EtsyTopListing,
  EtsyWirkung,
} from '@/lib/etsy/etsy-cockpit-types'
import { ladeEtsyKonkurrenz } from '@/lib/etsy/etsy-konkurrenz-server'
import type { EtsyEigeneSignale } from '@/lib/etsy/etsy-markt-types'
import { ladeEtsyListingDetail, ladeEtsyShopListings, updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
import { ETSY_SEO_TAG_COUNT, haerteEtsyListingFuerScore } from '@/lib/etsy/etsy-seo-regeln'
import {
  ladeEtsyHauptbegriffe,
  ladeEtsyRankVerluste,
  ladeEtsySeoCacheMap,
  ladeEtsySeoVorschlaege,
} from '@/lib/etsy/etsy-seo-audit-cache'
import { berlinTag, protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const HISTORIE_TAGE = 60
const MIGRATION_HINWEIS = 'Migration 20260929180000_etsy_cockpit.sql in Supabase ausführen — sonst fehlen Messung und Wirkung.'

function fehltTabelle(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '')))
}

async function ladeAktiveListings(ownerUserId: string): Promise<CockpitListing[]> {
  const out: CockpitListing[] = []
  for (let offset = 0; offset < 300; offset += 100) {
    const { listings } = await ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100, offset })
    for (const l of listings) {
      out.push({
        listingId: l.listingId,
        title: l.title,
        tags: l.tags ?? [],
        url: l.url ?? null,
        views: l.views ?? null,
        numFavorers: l.numFavorers ?? null,
      })
    }
    if (listings.length < 100) break
  }
  return out
}

type StatRow = { listing_id: number; tag: string; views: number | null; favoriten: number | null }

async function ladeStatistik(ownerUserId: string, ab: string): Promise<{ rows: StatRow[]; fehlt: boolean }> {
  const sb = createSupabaseAdmin()
  const rows: StatRow[] = []
  for (let seite = 0; seite < 30; seite++) {
    const { data, error } = await sb
      .from('etsy_listing_statistik')
      .select('listing_id, tag, views, favoriten')
      .eq('owner_user_id', ownerUserId)
      .gte('tag', ab)
      .order('tag', { ascending: true })
      .order('listing_id', { ascending: true })
      .range(seite * 1000, seite * 1000 + 999)
    if (error) return { rows, fehlt: fehltTabelle(error) }
    rows.push(...((data ?? []) as StatRow[]))
    if (!data || data.length < 1000) break
  }
  return { rows, fehlt: false }
}

/** Heutigen Snapshot anlegen, falls der Cron noch nicht lief — Messung startet sofort. */
async function sichereHeutigenSnapshot(ownerUserId: string, listings: CockpitListing[], heute: string) {
  if (!listings.length) return
  await createSupabaseAdmin()
    .from('etsy_listing_statistik')
    .upsert(
      listings.map((l) => ({
        owner_user_id: ownerUserId,
        listing_id: l.listingId,
        tag: heute,
        views: l.views,
        favoriten: l.numFavorers,
      })),
      { onConflict: 'owner_user_id,listing_id,tag', ignoreDuplicates: true },
    )
}

export async function baueEtsyCockpit(ownerUserId: string, sbUser: SupabaseClient): Promise<EtsyCockpitErgebnis> {
  const admin = createSupabaseAdmin()
  const heute = berlinTag()
  const ab = tagMinus(heute, HISTORIE_TAGE)
  const hinweise: string[] = []

  const listings = await ladeAktiveListings(ownerUserId)
  await sichereHeutigenSnapshot(ownerUserId, listings, heute).catch(() => undefined)

  const [
    stat,
    scoreMap,
    vorschlaege,
    rankVerluste,
    hauptbegriffe,
    merkRes,
    verkaufRes,
    aenderungRes,
    statusRes,
    konkurrenz,
  ] = await Promise.all([
    ladeStatistik(ownerUserId, ab),
    ladeEtsySeoCacheMap(ownerUserId).catch(() => new Map()),
    ladeEtsySeoVorschlaege(ownerUserId, 'offen').catch(() => []),
    ladeEtsyRankVerluste(ownerUserId).catch(() => []),
    ladeEtsyHauptbegriffe(ownerUserId).catch(() => new Map<number, string>()),
    admin
      .from('etsy_keyword_merkliste')
      .select('keyword, chance, nachfrage')
      .eq('owner_user_id', ownerUserId)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('etsy_listing_verkauf')
      .select('listing_id, menge, preis_eur, verkauft_at')
      .eq('owner_user_id', ownerUserId)
      .gte('verkauft_at', new Date(Date.now() - HISTORIE_TAGE * 86_400_000).toISOString())
      .limit(5000),
    admin
      .from('etsy_seo_aenderung')
      .select('id, listing_id, listing_title, quelle, beschreibung, created_at')
      .eq('owner_user_id', ownerUserId)
      .gte('created_at', new Date(Date.now() - 45 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(40),
    admin.from('etsy_aufgabe_status').select('aufgabe_key, status, bis').eq('owner_user_id', ownerUserId),
    ladeEtsyKonkurrenz(sbUser, 90).catch(() => null),
  ])

  if (stat.fehlt || fehltTabelle(verkaufRes.error) || fehltTabelle(aenderungRes.error) || fehltTabelle(statusRes.error)) {
    hinweise.push(MIGRATION_HINWEIS)
  }

  // --- Messreihen je Listing
  const reihen = new Map<number, StatPunkt[]>()
  const messTageSet = new Set<string>()
  for (const r of stat.rows) {
    const id = Number(r.listing_id)
    const t = String(r.tag)
    messTageSet.add(t)
    const liste = reihen.get(id) ?? []
    liste.push({ tag: t, views: r.views, favoriten: r.favoriten })
    reihen.set(id, liste)
  }
  const messTage = messTageSet.size
  const letzterTag = [...messTageSet].sort().pop() ?? heute

  const statistik = new Map<number, { views7: number | null; views7Vorher: number | null; fav30: number | null; views30: number | null; fav7: number | null; fav7Vorher: number | null }>()
  let views7 = 0, views7Vorher = 0, fav7 = 0, fav7Vorher = 0
  let hat7 = false, hatVorher = false
  for (const l of listings) {
    const reihe = reihen.get(l.listingId) ?? []
    const v7 = zuwachsImFenster(reihe, tagMinus(letzterTag, 7), letzterTag, 'views')
    const v7v = zuwachsImFenster(reihe, tagMinus(letzterTag, 14), tagMinus(letzterTag, 7), 'views')
    const f7 = zuwachsImFenster(reihe, tagMinus(letzterTag, 7), letzterTag, 'favoriten')
    const f7v = zuwachsImFenster(reihe, tagMinus(letzterTag, 14), tagMinus(letzterTag, 7), 'favoriten')
    const v30 = zuwachsImFenster(reihe, tagMinus(letzterTag, 30), letzterTag, 'views')
    const f30 = zuwachsImFenster(reihe, tagMinus(letzterTag, 30), letzterTag, 'favoriten')
    statistik.set(l.listingId, {
      views7: v7?.wert ?? null,
      views7Vorher: v7v?.wert ?? null,
      fav7: f7?.wert ?? null,
      fav7Vorher: f7v?.wert ?? null,
      views30: v30?.wert ?? null,
      fav30: f30?.wert ?? null,
    })
    if (v7) { views7 += v7.wert; hat7 = true }
    if (f7) fav7 += f7.wert
    if (v7v) { views7Vorher += v7v.wert; hatVorher = true }
    if (f7v) fav7Vorher += f7v.wert
  }

  // --- Verkäufe
  const verkaeufe = (verkaufRes.data ?? []).map((v) => ({
    listingId: v.listing_id != null ? Number(v.listing_id) : null,
    menge: Number(v.menge) || 1,
    preis: v.preis_eur != null ? Number(v.preis_eur) : 0,
    ts: Date.parse(String(v.verkauft_at)),
  }))
  const jetzt = Date.now()
  const in30 = verkaeufe.filter((v) => v.ts >= jetzt - 30 * 86_400_000)
  const vor30 = verkaeufe.filter((v) => v.ts < jetzt - 30 * 86_400_000 && v.ts >= jetzt - 60 * 86_400_000)
  const verkaufProListing = new Map<number, number>()
  for (const v of in30) if (v.listingId) verkaufProListing.set(v.listingId, (verkaufProListing.get(v.listingId) ?? 0) + v.menge)

  // --- Konkurrenz
  const konkShops = konkurrenz?.shops ?? []
  const eigen = konkShops.find((s) => s.eigener) ?? null
  const fremde = konkShops.filter((s) => !s.eigener)
  const konkurrenzTags = new Map<string, number>()
  for (const s of fremde) for (const t of new Set(s.topTags.map(normTag))) konkurrenzTags.set(t, (konkurrenzTags.get(t) ?? 0) + 1)
  const rangBasis = konkShops
    .map((s) => ({ eigener: s.eigener, wert: s.plus30 ?? s.seitStart }))
    .filter((s) => s.wert != null)
    .sort((a, b) => (b.wert ?? 0) - (a.wert ?? 0))
  const rangIndex = rangBasis.findIndex((s) => s.eigener)
  const konkurrenzSpikes = fremde
    .filter((s) => s.plus7 != null && s.proTag != null && s.messTage >= 14 && s.plus7 >= 5 && s.plus7 >= s.proTag * 7 * 2.5)
    .map((s) => ({ shopName: s.name, plus7: s.plus7!, normal7: Math.round(s.proTag! * 7) }))

  // --- Scores
  const scores = new Map<number, number>()
  for (const [id, e] of scoreMap as Map<number, { overallScore: number }>) scores.set(Number(id), e.overallScore)
  const aktiveIds = new Set(listings.map((l) => l.listingId))
  const aktiveScores = [...scores.entries()].filter(([id]) => aktiveIds.has(id)).map(([, s]) => s)

  // --- Änderungen
  const aenderungen = aenderungRes.data ?? []
  const letzteAenderung = new Map<number, string>()
  for (const a of aenderungen) {
    const id = Number(a.listing_id)
    if (!letzteAenderung.has(id)) letzteAenderung.set(id, String(a.created_at))
  }

  const merkliste = (merkRes.data ?? []).map((m) => ({
    keyword: String(m.keyword),
    chance: m.chance != null ? String(m.chance) : null,
    nachfrage: m.nachfrage != null ? Number(m.nachfrage) : null,
  }))

  const alleAufgaben = baueCockpitAufgaben({
    heute,
    listings,
    scores,
    vorschlaege: vorschlaege.map((v) => ({
      listingId: v.listingId,
      listingTitle: v.listingTitle,
      grund: v.grund,
      scoreVorher: v.scoreVorher,
      before: { title: v.before?.title ?? '', tags: v.before?.tags ?? [] },
      after: { title: v.after?.title ?? '', tags: v.after?.tags ?? [] },
    })),
    rankVerluste,
    hauptbegriffe,
    merkliste,
    konkurrenzTags,
    konkurrenzShops: fremde.length,
    statistik,
    letzteAenderung,
    konkurrenzSpikes,
  })

  const ausgeblendetKeys = new Set(
    (statusRes.data ?? [])
      .filter((s) => Date.parse(String(s.bis)) > jetzt)
      .map((s) => String(s.aufgabe_key)),
  )
  const aufgaben = alleAufgaben.filter((a) => !ausgeblendetKeys.has(a.key))

  // --- Wirkung der letzten Änderungen
  const wirkung: EtsyWirkung[] = aenderungen.slice(0, 12).map((a) => {
    const id = Number(a.listing_id)
    const reihe = reihen.get(id) ?? []
    const tag = berlinTag(new Date(String(a.created_at)))
    const tageSeither = Math.max(0, Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${tag}T12:00:00Z`)) / 86_400_000))
    const fenster = Math.max(1, Math.min(14, tageSeither))
    const vorherV = zuwachsImFenster(reihe, tagMinus(tag, fenster), tag, 'views')
    const nachherV = tageSeither > 0 ? zuwachsImFenster(reihe, tag, letzterTag, 'views') : null
    const vorherF = zuwachsImFenster(reihe, tagMinus(tag, fenster), tag, 'favoriten')
    const nachherF = tageSeither > 0 ? zuwachsImFenster(reihe, tag, letzterTag, 'favoriten') : null
    const t0 = Date.parse(String(a.created_at))
    const fensterMs = fenster * 86_400_000
    const zaehle = (von: number, bis: number) =>
      verkaeufe.filter((v) => v.listingId === id && v.ts >= von && v.ts < bis).reduce((s, v) => s + v.menge, 0)
    const proTag = (x: { wert: number; tage: number } | null) => (x && x.tage > 0 ? Math.round((x.wert / x.tage) * 10) / 10 : null)
    const basis = {
      id: String(a.id),
      listingId: id,
      listingTitle: String(a.listing_title || ''),
      quelle: a.quelle as EtsyWirkung['quelle'],
      beschreibung: String(a.beschreibung || ''),
      am: String(a.created_at),
      tageSeither,
      viewsProTagVorher: proTag(vorherV),
      viewsProTagNachher: proTag(nachherV),
      favProTagVorher: proTag(vorherF),
      favProTagNachher: proTag(nachherF),
      verkaeufeVorher: zaehle(t0 - fensterMs, t0),
      verkaeufeNachher: zaehle(t0, t0 + fensterMs),
    }
    return { ...basis, urteil: bewerteWirkung(basis) }
  })

  const sortWert = (t: EtsyTopListing, lebenszeitViews: number) =>
    (t.views7 ?? lebenszeitViews / 100) + t.verkaeufe30 * 50
  const topListings: EtsyTopListing[] = listings
    .map((l) => {
      const s = statistik.get(l.listingId)
      const t: EtsyTopListing = {
        listingId: l.listingId,
        title: l.title,
        url: l.url,
        views7: s?.views7 ?? null,
        favoriten7: s?.fav7 ?? null,
        verkaeufe30: verkaufProListing.get(l.listingId) ?? 0,
        score: scores.get(l.listingId) ?? null,
      }
      return { t, wert: sortWert(t, l.views ?? 0) }
    })
    .sort((a, b) => b.wert - a.wert)
    .slice(0, 5)
    .map((x) => x.t)

  const kpis: EtsyCockpitKpis = {
    aktiveListings: listings.length,
    views7: hat7 ? views7 : null,
    views7Vorher: hatVorher ? views7Vorher : null,
    favoriten7: hat7 ? fav7 : null,
    favoriten7Vorher: hatVorher ? fav7Vorher : null,
    verkaeufe30: verkaufRes.error ? null : in30.reduce((s, v) => s + v.menge, 0),
    umsatz30: verkaufRes.error ? null : Math.round(in30.reduce((s, v) => s + v.preis * v.menge, 0)),
    verkaeufe30Vorher: verkaufRes.error ? null : vor30.reduce((s, v) => s + v.menge, 0),
    scoreSchnitt: aktiveScores.length ? Math.round(aktiveScores.reduce((s, x) => s + x, 0) / aktiveScores.length) : null,
    auditiert: aktiveScores.length,
    konkurrenzRang: rangIndex >= 0 ? rangIndex + 1 : null,
    konkurrenzAnzahl: rangBasis.length,
    eigeneVerkaeufeGesamt: eigen?.verkaeufeGesamt ?? null,
    messTage,
  }

  if (!stat.fehlt && messTage < 8) {
    hinweise.push(
      `Messung läuft seit ${messTage} Tag${messTage === 1 ? '' : 'en'} — Wochenvergleich der Aufrufe ab Tag 8, Wirkung von Änderungen nach 7 Tagen.`,
    )
  }
  if (!verkaufRes.error && verkaeufe.length === 0 && (eigen?.plus30 ?? 0) > 0) {
    hinweise.push('Verkäufe werden noch nicht gelesen — Etsy einmal trennen und neu verbinden (Berechtigung „Verkäufe“).')
  }
  if (!konkShops.length) hinweise.push('Konkurrenz noch nicht ermittelt — im Tab „Konkurrenz“ einmal starten, dann liefert das Cockpit Tag-Lücken.')
  const tagsLuecke = listings.filter((l) => l.tags.length !== ETSY_SEO_TAG_COUNT).length
  if (tagsLuecke) {
    hinweise.unshift(
      `${tagsLuecke} Listing${tagsLuecke === 1 ? '' : 's'} haben weniger als 13 Tags. Oben unter Aufgaben mit einem Klick wiederherstellen — nicht einzeln tauschen.`,
    )
  }
  if (!merkliste.length) hinweise.push('Tipp: Keywords im Finder merken — das Cockpit schlägt dann vor, wo sie eingebaut werden.')

  const kostenProbe = await createSupabaseAdmin()
    .from('etsy_produkt_kosten')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId)
  if (!fehltTabelle(kostenProbe.error) && (kostenProbe.count ?? 0) === 0 && listings.length > 0) {
    hinweise.push('Noch keine Stückkosten — Tab „Geld“: sonst ist die Marge blind.')
  }
  const bestProbe = await createSupabaseAdmin()
    .from('etsy_bestellung')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId)
    .in('status', ['neu', 'fertigung', 'verpacken'])
  if (!fehltTabelle(bestProbe.error) && (bestProbe.count ?? 0) > 0) {
    hinweise.unshift(`${bestProbe.count} offene Bestellung(en) — Tab „Betrieb“.`)
  }

  return {
    kpis,
    aufgaben,
    ausgeblendet: alleAufgaben.length - aufgaben.length,
    wirkung,
    topListings,
    hinweise,
    stand: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type TagTauschErgebnis = {
  listingId: number
  ok: boolean
  fehler?: string
  getauscht: Array<{ alt: string | null; neu: string }>
}

/**
 * Tag-Tausch auf Etsy ausführen. `alt: undefined` → Server wählt den verzichtbarsten Tag
 * (z. B. wenn der Nutzer im Cockpit ein anderes Listing gewählt hat).
 */
export async function fuehreTagTauschAus(
  ownerUserId: string,
  tausch: Array<Pick<EtsyTagTausch, 'listingId' | 'neu'> & { alt?: string | null }>,
  aufgabeKey?: string,
): Promise<TagTauschErgebnis[]> {
  const proListing = new Map<number, typeof tausch>()
  for (const t of tausch.slice(0, 40)) proListing.set(t.listingId, [...(proListing.get(t.listingId) ?? []), t])
  const hauptbegriffe = await ladeEtsyHauptbegriffe(ownerUserId).catch(() => new Map<number, string>())
  const { aktiv, vorbei } = saisonStatus(berlinTag())
  const ergebnisse: TagTauschErgebnis[] = []

  for (const [listingId, liste] of proListing) {
    try {
      const { listing } = await ladeEtsyListingDetail(ownerUserId, listingId)
      let tags = [...listing.tags]
      const getauscht: TagTauschErgebnis['getauscht'] = []
      for (const t of liste) {
        const hb = hauptbegriffe.get(listingId)
        let alt = t.alt
        const altFehlt =
          alt === undefined ||
          (alt === null && tags.length >= ETSY_SEO_TAG_COUNT) ||
          (alt != null && !tags.some((x) => normTag(x) === normTag(alt!)))
        if (altFehlt) {
          const wahl = waehleErsatzTag(tags, {
            title: listing.title,
            schuetzen: [...(hb ? [hb] : []), ...getauscht.map((g) => g.neu)],
            saisonAktiv: aktiv,
            saisonVorbei: vorbei,
          })
          if (!wahl) continue
          alt = wahl.alt
        }
        const neu = wendeTagTauschAn(tags, alt ?? null, t.neu)
        if (!neu) continue
        tags = neu
        getauscht.push({ alt: alt ?? null, neu: normTag(t.neu) })
      }
      if (!getauscht.length) {
        ergebnisse.push({ listingId, ok: false, fehler: 'Tag schon vorhanden oder kein Platz', getauscht })
        continue
      }
      if (tags.length !== ETSY_SEO_TAG_COUNT) {
        tags = haerteEtsyListingFuerScore({
          title: listing.title,
          tags,
          description: listing.description,
          holzart: listing.materials[0],
        }).tags
      }
      await updateEtsyListing(ownerUserId, listingId, { tags })
      await protokolliereEtsyAenderung({
        ownerUserId,
        listingId,
        listingTitle: listing.title,
        quelle: 'aufgabe',
        beschreibung:
          'Cockpit: ' + getauscht.map((g) => (g.alt ? `„${g.alt}“ → „${g.neu}“` : `+„${g.neu}“`)).join(', '),
        before: { tags: listing.tags },
        after: { tags },
      })
      ergebnisse.push({ listingId, ok: true, getauscht })
    } catch (e) {
      ergebnisse.push({ listingId, ok: false, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Fehler', getauscht: [] })
    }
  }

  if (aufgabeKey && ergebnisse.some((e) => e.ok)) {
    await setzeEtsyAufgabeStatus(ownerUserId, aufgabeKey, 'erledigt', 30).catch(() => undefined)
  }
  return ergebnisse
}

export async function setzeEtsyAufgabeStatus(
  ownerUserId: string,
  key: string,
  status: 'ausgeblendet' | 'erledigt',
  tage: number,
): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from('etsy_aufgabe_status')
    .upsert(
      {
        owner_user_id: ownerUserId,
        aufgabe_key: key.slice(0, 200),
        status,
        bis: new Date(Date.now() + Math.max(1, Math.min(365, tage)) * 86_400_000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id,aufgabe_key' },
    )
  if (error) throw new Error(fehltTabelle(error) ? MIGRATION_HINWEIS : error.message)
}

/** Keyword-Finder „Einbauen“: bestes Listing + zu ersetzender Tag, plus Alternativen. */
export async function planeKeywordEinbau(
  ownerUserId: string,
  keyword: string,
  listingId?: number,
): Promise<{
  plan: EtsyTagTausch | null
  optionen: Array<{ listingId: number; title: string }>
  grund?: string
}> {
  const [listings, hauptbegriffe] = await Promise.all([
    ladeAktiveListings(ownerUserId),
    ladeEtsyHauptbegriffe(ownerUserId).catch(() => new Map<number, string>()),
  ])
  const { aktiv, vorbei } = saisonStatus(berlinTag())
  const passend = passendeListings(keyword, listings, 6)
  const optionen = passend.map((p) => ({ listingId: p.listing.listingId, title: p.listing.title }))
  const kandidaten = listingId
    ? listings.filter((l) => l.listingId === listingId)
    : passend.map((p) => p.listing)
  if (listingId && !optionen.some((o) => o.listingId === listingId) && kandidaten[0]) {
    optionen.unshift({ listingId, title: kandidaten[0].title })
  }
  for (const l of kandidaten) {
    const hb = hauptbegriffe.get(l.listingId)
    const plan = planeTagTausch(l, keyword, { schuetzen: hb ? [hb] : [], saisonAktiv: aktiv, saisonVorbei: vorbei })
    if (plan) return { plan, optionen }
  }
  if (!optionen.length && !listingId) {
    return { plan: null, optionen: listings.slice(0, 20).map((l) => ({ listingId: l.listingId, title: l.title })), grund: 'Kein Listing passt eindeutig — wähle selbst.' }
  }
  return { plan: null, optionen, grund: listingId ? 'Keyword steckt dort schon oder kein Tag ist verzichtbar.' : 'Überall schon vorhanden oder kein Tag verzichtbar.' }
}

/** Shop-eigene Signale für KI-Prompts (Audit, Generator): Merkliste, Top-Drechsler-Tags, Saison. */
export async function ladeEtsyEigeneSignale(ownerUserId: string): Promise<EtsyEigeneSignale> {
  const admin = createSupabaseAdmin()
  const [{ data: merk }, { data: shops }] = await Promise.all([
    admin
      .from('etsy_keyword_merkliste')
      .select('keyword')
      .eq('owner_user_id', ownerUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('etsy_konkurrenz_shop')
      .select('top_tags')
      .eq('owner_user_id', ownerUserId)
      .eq('aktiv', true)
      .eq('eigener', false),
  ])
  const zaehler = new Map<string, number>()
  for (const s of shops ?? []) {
    const tags = Array.isArray(s.top_tags) ? (s.top_tags as unknown[]).map((t) => normTag(String(t))) : []
    for (const t of new Set(tags)) zaehler.set(t, (zaehler.get(t) ?? 0) + 1)
  }
  const { aktiv } = saisonStatus(berlinTag())
  return {
    merkliste: (merk ?? []).map((m) => String(m.keyword)),
    konkurrenzTags: [...zaehler.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, n]) => ({ tag, shops: n })),
    konkurrenzShops: (shops ?? []).length,
    saison: aktiv.map((s) => ({ name: s.name, tag: s.tag })),
  }
}

/** Für den SEO-Cron: Listings mit Aufruf-Einbruch (≥ 50 % vs. Vorwoche, Basis ≥ 15). */
export async function ladeEtsyViewsEinbrueche(ownerUserId: string): Promise<Array<{ listingId: number; vorher: number; jetzt: number }>> {
  const heute = berlinTag()
  const { rows } = await ladeStatistik(ownerUserId, tagMinus(heute, 16))
  const reihen = new Map<number, StatPunkt[]>()
  let letzter = heute
  for (const r of rows) {
    const liste = reihen.get(Number(r.listing_id)) ?? []
    liste.push({ tag: String(r.tag), views: r.views, favoriten: r.favoriten })
    reihen.set(Number(r.listing_id), liste)
  }
  const tage = [...new Set(rows.map((r) => String(r.tag)))].sort()
  if (tage.length) letzter = tage[tage.length - 1]!
  const out: Array<{ listingId: number; vorher: number; jetzt: number }> = []
  for (const [id, reihe] of reihen) {
    const j = zuwachsImFenster(reihe, tagMinus(letzter, 7), letzter, 'views')
    const v = zuwachsImFenster(reihe, tagMinus(letzter, 14), tagMinus(letzter, 7), 'views')
    if (j && v && v.wert >= 15 && j.wert <= v.wert * 0.5) out.push({ listingId: id, vorher: v.wert, jetzt: j.wert })
  }
  return out.sort((a, b) => b.vorher - b.jetzt - (a.vorher - a.jetzt))
}

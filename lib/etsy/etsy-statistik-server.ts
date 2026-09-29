/**
 * Tägliche Messung eigener Listings + Änderungs-Log (Wirkung von SEO-Änderungen).
 *
 * - views / num_favorers sind Lebenszeit-Zähler → täglicher Snapshot, Differenz = Tageswert.
 * - Verkäufe über /shops/{id}/transactions (Scope transactions_r). Ohne Scope: still überspringen.
 */

import 'server-only'

import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { etsyFetchJson, holeGueltigenEtsyAccessToken, stelleShopIdSicher } from '@/lib/etsy/etsy-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export function berlinTag(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
}

type ApiTransaktion = {
  transaction_id?: number
  listing_id?: number | null
  quantity?: number
  price?: { amount?: number; divisor?: number }
  created_timestamp?: number
  create_timestamp?: number
}

const VERKAUF_FENSTER_TAGE = 45
const MAX_TRANSAKTIONS_SEITEN = 5

async function erfasseVerkaeufe(ownerUserId: string): Promise<{ anzahl: number; fehler?: string }> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)
  const grenze = Date.now() - VERKAUF_FENSTER_TAGE * 86_400_000
  const zeilen: Array<Record<string, unknown>> = []
  for (let seite = 0; seite < MAX_TRANSAKTIONS_SEITEN; seite++) {
    let data: { results?: ApiTransaktion[] }
    try {
      data = await etsyFetchJson<{ results?: ApiTransaktion[] }>(
        tokens.accessToken,
        `/application/shops/${shopId}/transactions?limit=100&offset=${seite * 100}`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 403 = Scope transactions_r fehlt (alte Verbindung) — kein Fehler fürs Cockpit.
      return { anzahl: zeilen.length, fehler: /\b40[13]\b/.test(msg) ? 'scope' : msg.slice(0, 160) }
    }
    const results = data.results ?? []
    let aelteste = Infinity
    for (const t of results) {
      const ts = Number(t.created_timestamp ?? t.create_timestamp) * 1000
      if (!Number.isFinite(ts) || !t.transaction_id) continue
      aelteste = Math.min(aelteste, ts)
      if (ts < grenze) continue
      const betrag = Number(t.price?.amount)
      zeilen.push({
        owner_user_id: ownerUserId,
        transaction_id: Number(t.transaction_id),
        listing_id: t.listing_id != null ? Number(t.listing_id) : null,
        menge: Math.max(1, Number(t.quantity) || 1),
        preis_eur: Number.isFinite(betrag) ? Math.round((betrag / (Number(t.price?.divisor) || 100)) * 100) / 100 : null,
        verkauft_at: new Date(ts).toISOString(),
      })
    }
    if (results.length < 100 || aelteste < grenze) break
  }
  if (zeilen.length) {
    const { error } = await createSupabaseAdmin()
      .from('etsy_listing_verkauf')
      .upsert(zeilen, { onConflict: 'owner_user_id,transaction_id' })
    if (error) return { anzahl: 0, fehler: error.message }
  }
  return { anzahl: zeilen.length }
}

export type StatistikLauf = { listings: number; verkaeufe: number; verkaufHinweis?: string; fehler?: string }

/** Tages-Snapshot aller aktiven Listings (max. 300) + Verkäufe der letzten 45 Tage. */
export async function erfasseEtsyListingStatistik(ownerUserId: string): Promise<StatistikLauf> {
  const tag = berlinTag()
  const zeilen: Array<Record<string, unknown>> = []
  try {
    for (let offset = 0; offset < 300; offset += 100) {
      const { listings } = await ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100, offset })
      for (const l of listings) {
        zeilen.push({
          owner_user_id: ownerUserId,
          listing_id: l.listingId,
          tag,
          views: l.views,
          favoriten: l.numFavorers,
        })
      }
      if (listings.length < 100) break
    }
  } catch (e) {
    return { listings: 0, verkaeufe: 0, fehler: e instanceof Error ? e.message.slice(0, 160) : 'Listings nicht ladbar' }
  }
  if (zeilen.length) {
    const { error } = await createSupabaseAdmin()
      .from('etsy_listing_statistik')
      .upsert(zeilen, { onConflict: 'owner_user_id,listing_id,tag' })
    if (error) return { listings: 0, verkaeufe: 0, fehler: error.message }
  }
  const v = await erfasseVerkaeufe(ownerUserId).catch((e) => ({
    anzahl: 0,
    fehler: e instanceof Error ? e.message.slice(0, 160) : 'Verkäufe nicht ladbar',
  }))
  return {
    listings: zeilen.length,
    verkaeufe: v.anzahl,
    verkaufHinweis: v.fehler === 'scope' ? 'Verkäufe: Etsy neu verbinden (Berechtigung fehlt).' : v.fehler,
  }
}

export type EtsyAenderungInhalt = { title?: string; tags?: string[]; description?: string }

/** Jede Änderung, die das Tool auf Etsy schreibt — Basis für „Wirkung deiner Änderungen“. */
export async function protokolliereEtsyAenderung(opts: {
  ownerUserId: string
  listingId: number
  listingTitle: string
  quelle: 'vorschlag' | 'aufgabe' | 'manuell'
  beschreibung: string
  before?: EtsyAenderungInhalt | null
  after?: EtsyAenderungInhalt | null
}): Promise<void> {
  const kuerze = (x?: EtsyAenderungInhalt | null) =>
    x ? { title: x.title, tags: x.tags, description: x.description?.slice(0, 600) } : null
  const { error } = await createSupabaseAdmin()
    .from('etsy_seo_aenderung')
    .insert({
      owner_user_id: opts.ownerUserId,
      listing_id: opts.listingId,
      listing_title: opts.listingTitle.slice(0, 200),
      quelle: opts.quelle,
      beschreibung: opts.beschreibung.slice(0, 300),
      before_json: kuerze(opts.before),
      after_json: kuerze(opts.after),
    })
  if (error) console.warn('[etsy aenderung]', error.message)
}

/** Kurzbeschreibung eines Diffs, z. B. „Titel · 2 Tags (+obstschale buche −holzdeko)“. */
export function beschreibeAenderung(before: EtsyAenderungInhalt, after: EtsyAenderungInhalt): string {
  const teile: string[] = []
  if (after.title != null && after.title.trim() !== (before.title ?? '').trim()) teile.push('Titel')
  if (after.tags) {
    const alt = new Set((before.tags ?? []).map((t) => t.toLowerCase()))
    const neu = new Set(after.tags.map((t) => t.toLowerCase()))
    const plus = [...neu].filter((t) => !alt.has(t))
    const minus = [...alt].filter((t) => !neu.has(t))
    if (plus.length || minus.length) {
      const detail = [...plus.slice(0, 2).map((t) => `+${t}`), ...minus.slice(0, 2).map((t) => `−${t}`)].join(' ')
      teile.push(`${plus.length} Tag${plus.length === 1 ? '' : 's'} (${detail})`)
    }
  }
  if (after.description != null && after.description.trim() !== (before.description ?? '').trim()) {
    teile.push('Beschreibung')
  }
  return teile.join(' · ') || 'Keine inhaltliche Änderung'
}

/**
 * Shop-weit: fehlende GEO-Einleitungen per KI erzeugen und vor Prozess/Specs setzen.
 * Abrundung am Ende bleibt; Titel/Tags unverändert.
 */
import {
  fehltProduktEinleitungVorne,
  setzeBeschreibungIntro,
} from '@/lib/etsy/etsy-beschreibung-intro'
import { ladeEtsyEigeneSignale } from '@/lib/etsy/etsy-cockpit-server'
import { normalisiereDrechselSprache } from '@/lib/etsy/etsy-drechsel-sprache'
import { ladeEtsyListingDetail, ladeEtsyShopListings, updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
import { auditiereEtsyListing } from '@/lib/etsy/etsy-seo-audit-engine'
import { ladeEtsyHauptbegriff } from '@/lib/etsy/etsy-seo-audit-cache'
import { protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ZEITBUDGET_MS = 270_000
const MAX_PRO_LAUF = 12

type Body = { state?: string; limit?: number; forceAlle?: boolean }

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* optional */
  }
  const state = body.state || 'active'
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 100)
  const forceAlle = body.forceAlle === true
  const start = Date.now()

  try {
    const { listings } = await ladeEtsyShopListings(user.id, { state, limit })
    const eigeneSignale = await ladeEtsyEigeneSignale(user.id).catch(() => null)

    let gesetzt = 0
    let uebersprungen = 0
    let fehlgeschlagen = 0
    const fehler: Array<{ listingId: number; error: string }> = []
    let abbruchZeit = false

    for (const kurz of listings) {
      if (Date.now() - start > ZEITBUDGET_MS || gesetzt >= MAX_PRO_LAUF) {
        abbruchZeit = true
        break
      }
      try {
        const [{ listing }, hauptbegriff] = await Promise.all([
          ladeEtsyListingDetail(user.id, kurz.listingId),
          ladeEtsyHauptbegriff(user.id, kurz.listingId).catch(() => null),
        ])
        const basis = normalisiereDrechselSprache(listing.description.trim())
        if (!forceAlle && !fehltProduktEinleitungVorne(basis)) {
          uebersprungen++
          continue
        }

        const audit = await auditiereEtsyListing(listing, {
          hauptbegriff,
          eigeneSignale,
          marktLimits: { maxAutosuggest: 1, maxCompetitor: 0, budgetMs: 8_000 },
        })
        const intro = normalisiereDrechselSprache(
          audit.suggestions.optimized_description_intro.trim(),
        )
        if (!intro || intro.length < 40) {
          fehlgeschlagen++
          fehler.push({ listingId: kurz.listingId, error: 'KI-Einleitung zu kurz/leer' })
          continue
        }

        const neu = setzeBeschreibungIntro(basis, intro)
        if (neu === basis) {
          uebersprungen++
          continue
        }

        await updateEtsyListing(user.id, kurz.listingId, { description: neu })
        await protokolliereEtsyAenderung({
          ownerUserId: user.id,
          listingId: kurz.listingId,
          listingTitle: listing.title,
          quelle: 'manuell',
          beschreibung: 'GEO-Einleitung gesetzt (Batch)',
          before: { title: listing.title, tags: listing.tags, description: listing.description },
          after: { title: listing.title, tags: listing.tags, description: neu },
        })
        gesetzt++
      } catch (e) {
        fehlgeschlagen++
        fehler.push({
          listingId: kurz.listingId,
          error: e instanceof Error ? e.message.slice(0, 120) : 'Fehler',
        })
      }
    }

    return NextResponse.json({
      ok: true,
      geprueft: listings.length,
      gesetzt,
      uebersprungen,
      fehlgeschlagen,
      abbruchZeit,
      hinweis: abbruchZeit
        ? `Zeit/Limit: ${gesetzt} gesetzt — Button erneut klicken für den Rest.`
        : undefined,
      fehler: fehler.slice(0, 8),
      dauerMs: Date.now() - start,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Einleitungen setzen fehlgeschlagen'
    console.error('[etsy einleitungen-setzen]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

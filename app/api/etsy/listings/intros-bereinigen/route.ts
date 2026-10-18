/**
 * Shop-weit: gestapelte GEO-/SEO-Einleitungen aus Beschreibungen entfernen.
 */
import { entferneGestapelteBeschreibungsIntros } from '@/lib/etsy/etsy-beschreibung-intro'
import { normalisiereDrechselSprache } from '@/lib/etsy/etsy-drechsel-sprache'
import { ladeEtsyListingDetail, ladeEtsyShopListings, updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
import { protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Body = { state?: string; limit?: number }

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

  try {
    const { listings } = await ladeEtsyShopListings(user.id, { state, limit })
    let bereinigt = 0
    let unveraendert = 0
    let fehlgeschlagen = 0

    for (const kurz of listings) {
      try {
        const { listing } = await ladeEtsyListingDetail(user.id, kurz.listingId)
        const basis = normalisiereDrechselSprache(listing.description.trim())
        const { cleaned, entfernt } = entferneGestapelteBeschreibungsIntros(basis)
        if (cleaned === basis) {
          unveraendert++
          continue
        }
        await updateEtsyListing(user.id, kurz.listingId, { description: cleaned })
        await protokolliereEtsyAenderung({
          ownerUserId: user.id,
          listingId: kurz.listingId,
          listingTitle: listing.title,
          quelle: 'manuell',
          beschreibung: `Gestapelte Intros entfernt (${entfernt})`,
          before: { title: listing.title, tags: listing.tags, description: listing.description },
          after: { title: listing.title, tags: listing.tags, description: cleaned },
        })
        bereinigt++
      } catch {
        fehlgeschlagen++
      }
    }

    return NextResponse.json({
      ok: true,
      geprueft: listings.length,
      bereinigt,
      unveraendert,
      fehlgeschlagen,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Bereinigung fehlgeschlagen'
    console.error('[etsy intros-bereinigen]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

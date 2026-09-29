import {
  ladeEtsySeoVorschlag,
  setzeEtsySeoVorschlagStatus,
} from '@/lib/etsy/etsy-seo-audit-cache'
import { listingFingerprint } from '@/lib/etsy/etsy-seo-diff'
import { ladeEtsyListingDetail, updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
import { beschreibeAenderung, protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import {
  ETSY_SEO_TAG_COUNT,
  ETSY_SEO_TAG_MAX,
  ETSY_SEO_TITLE_MAX,
} from '@/lib/etsy/etsy-seo-regeln'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }
type Body = { aktion?: 'uebernehmen' | 'verwerfen' }

/** 1-Klick: Vorschlag auf Etsy übernehmen oder verwerfen. */
export async function POST(req: Request, ctx: Ctx) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const { id } = await ctx.params
  const listingId = Number(id)
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return NextResponse.json({ error: 'Ungültige listing id.' }, { status: 400 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }
  if (body.aktion !== 'uebernehmen' && body.aktion !== 'verwerfen') {
    return NextResponse.json({ error: 'aktion muss uebernehmen oder verwerfen sein.' }, { status: 400 })
  }

  try {
    const vorschlag = await ladeEtsySeoVorschlag(user.id, listingId)
    if (!vorschlag || vorschlag.status !== 'offen') {
      return NextResponse.json({ error: 'Kein offener Vorschlag für dieses Listing.' }, { status: 404 })
    }

    if (body.aktion === 'verwerfen') {
      await setzeEtsySeoVorschlagStatus(user.id, listingId, 'verworfen')
      return NextResponse.json({ ok: true, status: 'verworfen' })
    }

    const { listing: aktuell } = await ladeEtsyListingDetail(user.id, listingId)
    if (listingFingerprint(aktuell) !== vorschlag.fingerprint) {
      await setzeEtsySeoVorschlagStatus(user.id, listingId, 'veraltet')
      return NextResponse.json(
        { error: 'Listing wurde seit dem Vorschlag auf Etsy geändert — bitte neu auditieren.' },
        { status: 409 },
      )
    }

    const { title, tags, description } = vorschlag.after
    if (!title?.trim() || title.length > ETSY_SEO_TITLE_MAX) {
      return NextResponse.json({ error: `Titel ungültig (max. ${ETSY_SEO_TITLE_MAX}).` }, { status: 400 })
    }
    if (tags.length !== ETSY_SEO_TAG_COUNT || tags.some((t) => t.length > ETSY_SEO_TAG_MAX)) {
      return NextResponse.json(
        { error: `Genau ${ETSY_SEO_TAG_COUNT} Tags à ≤${ETSY_SEO_TAG_MAX} Zeichen nötig.` },
        { status: 400 },
      )
    }

    const listing = await updateEtsyListing(user.id, listingId, { title, tags, description })
    await setzeEtsySeoVorschlagStatus(user.id, listingId, 'uebernommen')
    const vorher = { title: aktuell.title, tags: aktuell.tags, description: aktuell.description }
    const nachher = { title, tags, description: description ?? aktuell.description }
    await protokolliereEtsyAenderung({
      ownerUserId: user.id,
      listingId,
      listingTitle: aktuell.title,
      quelle: 'vorschlag',
      beschreibung: `KI-Vorschlag übernommen: ${beschreibeAenderung(vorher, nachher)}`,
      before: vorher,
      after: nachher,
    })
    return NextResponse.json({ ok: true, status: 'uebernommen', listing })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Vorschlag-Aktion fehlgeschlagen'
    console.error('[etsy vorschlag]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

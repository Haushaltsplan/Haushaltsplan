import {
  entferneGestapelteBeschreibungsIntros,
  setzeBeschreibungIntro,
} from '@/lib/etsy/etsy-beschreibung-intro'
import {
  normalisiereDrechselSprache,
  normalisiereDrechselTags,
} from '@/lib/etsy/etsy-drechsel-sprache'
import { ladeEtsyListingDetail, updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
import { beschreibeAenderung, protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import {
  ETSY_SEO_TAG_COUNT,
  ETSY_SEO_TAG_MAX,
  ETSY_SEO_TITLE_MAX,
  pruefeEtsySeoRegeln,
} from '@/lib/etsy/etsy-seo-regeln'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

type Body = {
  title?: string
  description?: string
  tags?: string[]
  /**
   * @deprecated früher: Intro stapeln. Jetzt: Intro ersetzen (Stacks entfernen).
   * Alias für replaceIntro — bleibt für alte Clients gültig.
   */
  prependIntro?: boolean
  /** Intro-Abschnitt ersetzen, ohne weitere Varianten oben draufzulegen */
  replaceIntro?: boolean
  /** Nur gestapelte Intros entfernen, kein neues Intro setzen */
  bereinigeIntros?: boolean
  existingDescription?: string
  optimizedIntro?: string
}

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

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const title =
    typeof body.title === 'string' ? normalisiereDrechselSprache(body.title.trim()) : undefined
  const tags = Array.isArray(body.tags)
    ? normalisiereDrechselTags(
        body.tags.map(String).map((t) => t.trim()).filter(Boolean).slice(0, ETSY_SEO_TAG_COUNT),
        { aufDreizehn: true },
      )
    : undefined

  if (title != null) {
    if (!title) {
      return NextResponse.json({ error: 'Titel darf nicht leer sein.' }, { status: 400 })
    }
    if (title.length > ETSY_SEO_TITLE_MAX) {
      return NextResponse.json(
        { error: `Titel max. ${ETSY_SEO_TITLE_MAX} Zeichen (aktuell ${title.length}).` },
        { status: 400 },
      )
    }
  }
  if (tags) {
    if (tags.length !== ETSY_SEO_TAG_COUNT) {
      return NextResponse.json(
        { error: `Genau ${ETSY_SEO_TAG_COUNT} Tags nötig (aktuell ${tags.length}).` },
        { status: 400 },
      )
    }
    const tooLong = tags.find((t) => t.length > ETSY_SEO_TAG_MAX)
    if (tooLong) {
      return NextResponse.json(
        { error: `Tag zu lang (max. ${ETSY_SEO_TAG_MAX}): „${tooLong.slice(0, 24)}…“.` },
        { status: 400 },
      )
    }
  }

  try {
    const vorher = await ladeEtsyListingDetail(user.id, listingId)
      .then((r) => r.listing)
      .catch(() => null)
    if (!vorher) {
      return NextResponse.json({ error: 'Listing nicht geladen.' }, { status: 502 })
    }

    let description =
      typeof body.description === 'string' ? normalisiereDrechselSprache(body.description) : undefined
    const basis = normalisiereDrechselSprache(
      (body.existingDescription ?? vorher.description ?? description ?? '').trim(),
    )
    let entfernt = 0
    if (body.bereinigeIntros) {
      const r = entferneGestapelteBeschreibungsIntros(basis)
      description = r.cleaned
      entfernt = r.entfernt
      if (r.cleaned === basis) {
        return NextResponse.json({
          ok: true,
          listing: vorher,
          unveraendert: true,
          entfernt: 0,
          message: 'Keine gestapelten Intros gefunden.',
        })
      }
    } else if ((body.replaceIntro || body.prependIntro) && body.optimizedIntro?.trim()) {
      // Nie stapeln: alte Intro-Varianten runter, genau ein Intro setzen.
      description = setzeBeschreibungIntro(basis, normalisiereDrechselSprache(body.optimizedIntro.trim()))
    }

    // Soft-Report für die UI (blockiert nicht, außer harte Limits oben)
    const regelReport =
      title != null || tags != null || description != null
        ? pruefeEtsySeoRegeln({
            title: title ?? vorher.title,
            tags: tags ?? vorher.tags,
            description: description ?? vorher.description,
          })
        : null

    const listing = await updateEtsyListing(user.id, listingId, {
      title,
      description,
      tags,
    })
    const before = { title: vorher.title, tags: vorher.tags, description: vorher.description }
    const after = {
      title: title ?? vorher.title,
      tags: tags ?? vorher.tags,
      description: description ?? vorher.description,
    }
    await protokolliereEtsyAenderung({
      ownerUserId: user.id,
      listingId,
      listingTitle: vorher.title,
      quelle: 'manuell',
      beschreibung: body.bereinigeIntros
        ? `Gestapelte Intros entfernt (${entfernt})`
        : beschreibeAenderung(before, after),
      before,
      after,
    })
    return NextResponse.json({ ok: true, listing, regelReport, entfernt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Update fehlgeschlagen'
    console.error('[etsy update]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

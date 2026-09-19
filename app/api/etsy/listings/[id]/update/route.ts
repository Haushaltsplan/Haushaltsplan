import { updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
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
  /** Wenn true: Intro vor bestehende Beschreibung setzen */
  prependIntro?: boolean
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

  let description = typeof body.description === 'string' ? body.description : undefined
  if (body.prependIntro && body.optimizedIntro?.trim()) {
    const intro = body.optimizedIntro.trim()
    const rest = (body.existingDescription || description || '').trim()
    description = rest.startsWith(intro) ? rest : `${intro}\n\n${rest}`.trim()
  }

  const title = typeof body.title === 'string' ? body.title.trim() : undefined
  const tags = Array.isArray(body.tags)
    ? body.tags.map(String).map((t) => t.trim()).filter(Boolean).slice(0, ETSY_SEO_TAG_COUNT)
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

  // Soft-Report für die UI (blockiert nicht, außer harte Limits oben)
  const regelReport =
    title != null || tags != null || description != null
      ? pruefeEtsySeoRegeln({
          title: title ?? '',
          tags: tags ?? [],
          description: description ?? body.existingDescription ?? '',
        })
      : null

  try {
    const listing = await updateEtsyListing(user.id, listingId, {
      title,
      description,
      tags,
    })
    return NextResponse.json({ ok: true, listing, regelReport })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Update fehlgeschlagen'
    console.error('[etsy update]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

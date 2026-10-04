import {
  schreibeHandgedrehtUm,
  zaehleHandgedrehtListings,
} from '@/lib/etsy/etsy-drechsel-umschreiben'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Vorschau: wie viele aktive Listings noch „handgedreht“ enthalten. */
export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const stand = await zaehleHandgedrehtListings(user.id)
    return NextResponse.json({ ok: true, ...stand })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stand nicht lesbar'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

type Body = { dryRun?: boolean; listingIds?: number[]; state?: string }

/** Schreibt handgedreht → handgedrechselt in Titel, Beschreibung und Tags auf Etsy. */
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
    /* defaults */
  }

  try {
    const ergebnis = await schreibeHandgedrehtUm(user.id, {
      dryRun: body.dryRun === true,
      state: body.state || 'active',
      listingIds: Array.isArray(body.listingIds)
        ? body.listingIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : undefined,
    })
    return NextResponse.json({ ok: ergebnis.fehlgeschlagen === 0, ...ergebnis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Umschreibung fehlgeschlagen'
    console.error('[etsy handwerk-sprache]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

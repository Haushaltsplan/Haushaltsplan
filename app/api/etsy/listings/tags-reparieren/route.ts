import { repariereEtsyShopTags, zaehleUnvollstaendigeEtsyTags } from '@/lib/etsy/etsy-tags-reparatur'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Vorschau: welche aktiven Listings weniger als 13 Tags haben. */
export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const stand = await zaehleUnvollstaendigeEtsyTags(user.id)
    return NextResponse.json({ ok: true, ...stand })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stand nicht lesbar'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

type Body = { dryRun?: boolean; listingIds?: number[] }

/** Stellt 13 Tags je betroffenem Listing wieder her (Log → Vorschlag → Entwurf → Härtung). */
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
    const ergebnis = await repariereEtsyShopTags(user.id, {
      dryRun: body.dryRun === true,
      listingIds: Array.isArray(body.listingIds)
        ? body.listingIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : undefined,
    })
    return NextResponse.json({ ok: ergebnis.fehlgeschlagen === 0, ...ergebnis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Tags-Reparatur fehlgeschlagen'
    console.error('[etsy tags-reparieren]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

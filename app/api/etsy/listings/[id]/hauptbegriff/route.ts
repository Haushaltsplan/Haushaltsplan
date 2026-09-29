import { ladeEtsyHauptbegriff, speichereEtsyHauptbegriff } from '@/lib/etsy/etsy-seo-audit-cache'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

async function kontext(req: Request, ctx: Ctx) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return { fehler: NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 }) }
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return { fehler: NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 }) }
  const listingId = Number((await ctx.params).id)
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return { fehler: NextResponse.json({ error: 'Ungültige listing id.' }, { status: 400 }) }
  }
  return { userId: user.id, listingId }
}

export async function GET(req: Request, ctx: Ctx) {
  const k = await kontext(req, ctx)
  if ('fehler' in k) return k.fehler
  return NextResponse.json({ ok: true, hauptbegriff: await ladeEtsyHauptbegriff(k.userId, k.listingId) })
}

/** Body `{ hauptbegriff: string | null }` — null/leer = wieder automatisch ableiten. */
export async function PUT(req: Request, ctx: Ctx) {
  const k = await kontext(req, ctx)
  if ('fehler' in k) return k.fehler
  const body = (await req.json().catch(() => ({}))) as { hauptbegriff?: string | null }
  const hb = typeof body.hauptbegriff === 'string' ? body.hauptbegriff.trim() : ''
  if (hb && (hb.length < 2 || hb.length > 60)) {
    return NextResponse.json({ error: 'Hauptbegriff: 2–60 Zeichen.' }, { status: 400 })
  }
  try {
    await speichereEtsyHauptbegriff(k.userId, k.listingId, hb || null)
    return NextResponse.json({ ok: true, hauptbegriff: hb.toLowerCase() || null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' }, { status: 502 })
  }
}

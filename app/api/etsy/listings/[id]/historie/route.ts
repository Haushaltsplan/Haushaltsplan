import { ladeEtsySeoHistorie } from '@/lib/etsy/etsy-seo-audit-cache'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const { id } = await ctx.params
  const listingId = Number(id)
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ error: 'Ungültige id' }, { status: 400 })
  }

  try {
    const historie = await ladeEtsySeoHistorie(user.id, listingId, 30)
    return NextResponse.json({ ok: true, historie })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Historie fehlgeschlagen' },
      { status: 500 },
    )
  }
}

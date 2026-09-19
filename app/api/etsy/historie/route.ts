import { ladeEtsyDraftHistorie } from '@/lib/etsy/etsy-vorlage-historie'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const historie = await ladeEtsyDraftHistorie(user.id)
    return NextResponse.json({ ok: true, historie })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Historie laden fehlgeschlagen' },
      { status: 500 },
    )
  }
}

import { ladeEtsyShopKontext } from '@/lib/etsy/etsy-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })
  }

  try {
    const ctx = await ladeEtsyShopKontext(user.id)
    return NextResponse.json({ ok: true, ...ctx })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Shop-Kontext fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

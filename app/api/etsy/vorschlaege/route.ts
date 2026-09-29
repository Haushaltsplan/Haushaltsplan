import { ladeEtsySeoVorschlaege } from '@/lib/etsy/etsy-seo-audit-cache'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Offene, vom Cron vorbereitete SEO-Vorschläge. */
export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const vorschlaege = await ladeEtsySeoVorschlaege(user.id, 'offen')
    return NextResponse.json({ ok: true, vorschlaege })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Vorschläge laden fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

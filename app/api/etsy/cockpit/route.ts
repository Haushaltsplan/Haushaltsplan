import { baueEtsyCockpit } from '@/lib/etsy/etsy-cockpit-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET: Cockpit (KPIs, priorisierte Aufgaben, Wirkung) — regelbasiert, ohne Gemini. */
export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    return NextResponse.json({ ok: true, ...(await baueEtsyCockpit(user.id, sb)) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cockpit konnte nicht geladen werden'
    console.error('[etsy cockpit]', msg)
    return NextResponse.json({ error: msg }, { status: /nicht verbunden/i.test(msg) ? 409 : 502 })
  }
}

import { baueWhoopAuthUrl, whoopApiKonfiguriert } from '@/lib/fitnessdaten/whoop-cloud-server'
import { speichereWhoopPending } from '@/lib/fitnessdaten/whoop-oauth-store'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Startet WHOOP-OAuth mit Nutzer-ID in Supabase (funktioniert auch wenn OAuth im Browser endet). */
export async function POST(req: Request) {
  if (!whoopApiKonfiguriert()) {
    return NextResponse.json({ error: 'WHOOP OAuth nicht konfiguriert.' }, { status: 501 })
  }

  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user?.id) {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })
  }

  try {
    const state = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    await speichereWhoopPending(state, user.id)
    const origin = new URL(req.url).origin
    return NextResponse.json({ url: baueWhoopAuthUrl(origin, state) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth-Start fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { baueStravaAuthUrl, stravaApiKonfiguriert } from '@/lib/strava/strava-server'
import { speichereStravaPending } from '@/lib/strava/strava-oauth-store'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!stravaApiKonfiguriert()) {
    return NextResponse.json({ error: 'Strava OAuth nicht konfiguriert.' }, { status: 501 })
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
    await speichereStravaPending(state, user.id)
    const origin = new URL(req.url).origin
    return NextResponse.json({ url: baueStravaAuthUrl(origin, state) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth-Start fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

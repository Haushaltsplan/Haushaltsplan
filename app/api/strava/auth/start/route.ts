import { baueStravaAuthUrl, stravaApiKonfiguriert } from '@/lib/strava/strava-server'
import { MAX_GUEST_CONNECTIONS, MAX_STRAVA_CONNECTIONS, zaehleVerbindungen } from '@/lib/strava/strava-connections'
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

  let body: { mode?: string; label?: string } = {}
  try {
    body = (await req.json()) as { mode?: string; label?: string }
  } catch {
    /* optional */
  }

  const linkMode = body.mode === 'guest' ? 'guest' : 'primary'
  const guestLabel = typeof body.label === 'string' ? body.label.trim() : null

  if (linkMode === 'guest') {
    const count = await zaehleVerbindungen(sb, user.id)
    if (count >= MAX_STRAVA_CONNECTIONS) {
      return NextResponse.json(
        { error: `Maximal ${MAX_STRAVA_CONNECTIONS} Profile (du + ${MAX_GUEST_CONNECTIONS} Freunde).` },
        { status: 400 },
      )
    }
  }

  try {
    const state = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    await speichereStravaPending(state, user.id, { linkMode, guestLabel })
    const origin = new URL(req.url).origin
    return NextResponse.json({ url: baueStravaAuthUrl(origin, state), mode: linkMode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth-Start fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

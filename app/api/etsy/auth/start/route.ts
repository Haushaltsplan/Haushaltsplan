import {
  baueEtsyAuthUrl,
  erzeugePkcePaar,
  etsyApiKonfiguriert,
} from '@/lib/etsy/etsy-server'
import { speichereEtsyPending } from '@/lib/etsy/etsy-oauth-store'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!etsyApiKonfiguriert()) {
    return NextResponse.json({ error: 'Etsy OAuth nicht konfiguriert (ETSY_CLIENT_ID/SECRET).' }, { status: 501 })
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
    const state = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    const { codeVerifier, codeChallenge } = erzeugePkcePaar()
    await speichereEtsyPending(state, user.id, codeVerifier)
    const origin = new URL(req.url).origin
    return NextResponse.json({ url: baueEtsyAuthUrl(origin, state, codeChallenge) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth-Start fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

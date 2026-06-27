import { stravaTrenneVerbindung, stravaTrennen } from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  let body: { connectionId?: string; all?: boolean } = {}
  try {
    body = (await req.json()) as { connectionId?: string; all?: boolean }
  } catch {
    /* leer = alles trennen (Legacy) */
  }

  if (body.all || !body.connectionId) {
    await stravaTrennen(sb)
  } else {
    await stravaTrenneVerbindung(sb, body.connectionId)
  }

  return NextResponse.json({ ok: true })
}

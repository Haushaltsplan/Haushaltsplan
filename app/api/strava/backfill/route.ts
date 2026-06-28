import { ladeBackfillStatus, synchronisiereStravaBackfill } from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }
  const backfill = await ladeBackfillStatus(sb)
  return NextResponse.json({ ok: true, backfill })
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  let maxRounds = 15
  try {
    const body = (await req.json().catch(() => null)) as { maxRounds?: number } | null
    if (body?.maxRounds != null && body.maxRounds > 0 && body.maxRounds <= 30) {
      maxRounds = body.maxRounds
    }
  } catch {
    /* optional body */
  }

  try {
    const result = await synchronisiereStravaBackfill(sb, { maxRounds })
    const hints: string[] = []
    if (result.streamsAnalysiert > 0) hints.push(`${result.streamsAnalysiert} Streams`)
    if (result.wetterAngereichert > 0) hints.push(`${result.wetterAngereichert} Wetter`)
    if (result.segmenteGeladen > 0) hints.push(`${result.segmenteGeladen} Segmente`)

    return NextResponse.json({
      ok: true,
      message:
        result.backfill.allComplete
          ? `Analyse vollständig${hints.length ? ` (${hints.join(', ')})` : ''}.`
          : `${result.rounds} Durchläufe — noch ${result.backfill.totalPending} offen${hints.length ? ` · ${hints.join(', ')}` : ''}`,
      ...result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Backfill fehlgeschlagen'
    return NextResponse.json({ ok: false, message: msg, fehler: msg }, { status: 502 })
  }
}

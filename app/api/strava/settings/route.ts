import {
  effektivesGewichtKg,
  leseAthleteProfilDb,
  speichereOmniaGewicht,
  speichereSaisonZiele,
} from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseNum(v: unknown): number | null {
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v.replace(',', '.')) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const connectionId = new URL(req.url).searchParams.get('connection')
  const athlete = await leseAthleteProfilDb(sb, connectionId)
  return NextResponse.json({
    omnia_weight_kg: effektivesGewichtKg(athlete),
    athlete,
    connectionId,
  })
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const connectionId = typeof body.connectionId === 'string' ? body.connectionId : null

  try {
    if ('omnia_weight_kg' in body) {
      const raw = body.omnia_weight_kg
      const kg =
        raw === null || raw === ''
          ? null
          : typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
              ? Number.parseFloat(raw.replace(',', '.'))
              : NaN
      if (kg != null && (!Number.isFinite(kg) || kg <= 0 || kg > 300)) {
        return NextResponse.json({ error: 'Gewicht muss zwischen 1 und 300 kg liegen.' }, { status: 400 })
      }
      await speichereOmniaGewicht(sb, kg, connectionId)
    }

    if (
      'goal_km_year' in body ||
      'goal_hm_year' in body ||
      'goal_rides_per_week' in body ||
      'goal_event_name' in body ||
      'goal_event_date' in body
    ) {
      await speichereSaisonZiele(
        sb,
        {
          goal_km_year: parseNum(body.goal_km_year),
          goal_hm_year: parseNum(body.goal_hm_year),
          goal_rides_per_week:
            body.goal_rides_per_week != null && body.goal_rides_per_week !== ''
              ? Math.round(Number(body.goal_rides_per_week))
              : null,
          goal_event_name: typeof body.goal_event_name === 'string' ? body.goal_event_name : null,
          goal_event_date: typeof body.goal_event_date === 'string' ? body.goal_event_date : null,
        },
        connectionId,
      )
    }

    const athlete = await leseAthleteProfilDb(sb, connectionId)
    return NextResponse.json({ ok: true, omnia_weight_kg: effektivesGewichtKg(athlete), athlete, connectionId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

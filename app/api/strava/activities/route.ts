import { berechneAuswertung } from '@/lib/strava/strava-auswertung'
import {
  effektivesGewichtKg,
  ladeBackfillStatus,
  ladeGespeicherteAktivitaeten,
  ladeSegmentEfforts,
  leseAthleteProfilDb,
  zaehleSegmentBacklog,
} from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  const [activities, athlete, segmentEfforts, segmentBacklog, backfill] = await Promise.all([
    ladeGespeicherteAktivitaeten(sb),
    leseAthleteProfilDb(sb),
    ladeSegmentEfforts(sb),
    zaehleSegmentBacklog(sb),
    ladeBackfillStatus(sb),
  ])
  const weightKg = effektivesGewichtKg(athlete)
  const auswertung = berechneAuswertung(activities, weightKg)

  return NextResponse.json({
    activities,
    athlete,
    segmentEfforts,
    segmentBacklog,
    backfill,
    omnia_weight_kg: weightKg,
    auswertung,
  })
}

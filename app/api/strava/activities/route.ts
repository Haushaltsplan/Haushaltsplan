import { berechneAuswertung } from '@/lib/strava/strava-auswertung'
import {
  effektivesGewichtKg,
  ladeBackfillStatus,
  ladeGespeicherteAktivitaetenMitMeta,
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

  const [activitiesResult, athlete, segmentEfforts, segmentBacklog, backfill] = await Promise.all([
    ladeGespeicherteAktivitaetenMitMeta(sb),
    leseAthleteProfilDb(sb),
    ladeSegmentEfforts(sb),
    zaehleSegmentBacklog(sb),
    ladeBackfillStatus(sb),
  ])
  const activities = activitiesResult.rows
  const weightKg = effektivesGewichtKg(athlete)
  const auswertung = berechneAuswertung(activities, weightKg)

  return NextResponse.json({
    activities,
    activitiesLoadError: activitiesResult.loadError ?? null,
    activitiesSchemaHint: activitiesResult.schemaHint ?? null,
    athlete,
    segmentEfforts,
    segmentBacklog,
    backfill,
    omnia_weight_kg: weightKg,
    auswertung,
  })
}

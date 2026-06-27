import { berechneAuswertung } from '@/lib/strava/strava-auswertung'
import {
  effektivesGewichtKg,
  ladeGespeicherteAktivitaeten,
  leseAthleteProfilDb,
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

  const [activities, athlete] = await Promise.all([
    ladeGespeicherteAktivitaeten(sb),
    leseAthleteProfilDb(sb),
  ])
  const weightKg = effektivesGewichtKg(athlete)
  const auswertung = berechneAuswertung(activities, weightKg)

  return NextResponse.json({
    activities,
    athlete,
    omnia_weight_kg: weightKg,
    auswertung,
  })
}

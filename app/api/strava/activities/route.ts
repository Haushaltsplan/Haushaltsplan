import { berechneAuswertung } from '@/lib/strava/strava-auswertung'
import { primaereVerbindung } from '@/lib/strava/strava-connections'
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

  const url = new URL(req.url)
  let connectionId = url.searchParams.get('connection')
  if (!connectionId) {
    const primary = await primaereVerbindung(sb)
    connectionId = primary?.id ?? null
  }

  const [activities, athlete] = await Promise.all([
    ladeGespeicherteAktivitaeten(sb, connectionId),
    leseAthleteProfilDb(sb, connectionId),
  ])
  const weightKg = effektivesGewichtKg(athlete)
  const auswertung = berechneAuswertung(activities, weightKg)

  return NextResponse.json({
    activities,
    athlete,
    connectionId,
    omnia_weight_kg: weightKg,
    auswertung,
  })
}

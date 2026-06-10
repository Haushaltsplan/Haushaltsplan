import { effektivesGewichtKg, leseAthleteProfilDb, speichereOmniaGewicht } from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const athlete = await leseAthleteProfilDb(sb)
  return NextResponse.json({
    omnia_weight_kg: effektivesGewichtKg(athlete),
    athlete,
  })
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })

  let body: { omnia_weight_kg?: unknown }
  try {
    body = (await req.json()) as { omnia_weight_kg?: unknown }
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

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

  try {
    await speichereOmniaGewicht(sb, kg)
    const athlete = await leseAthleteProfilDb(sb)
    return NextResponse.json({ ok: true, omnia_weight_kg: effektivesGewichtKg(athlete), athlete })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

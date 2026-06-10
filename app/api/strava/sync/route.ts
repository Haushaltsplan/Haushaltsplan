import { holeGueltigenAccessToken, synchronisiereStravaAktivitaeten } from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const sb = createSupabaseFuerRequest(req)
    if (!sb) {
      return NextResponse.json({ ok: false, message: 'Anmeldung erforderlich.' }, { status: 401 })
    }
    const token = await holeGueltigenAccessToken(sb)
    if (!token) {
      return NextResponse.json(
        { ok: false, message: 'Strava nicht verbunden.', fehler: 'Strava-Konto nicht verbunden.' },
        { status: 401 },
      )
    }
    const result = await synchronisiereStravaAktivitaeten(sb, token)
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      message: `${result.imported} Aktivitäten aktualisiert — ${result.total} gespeichert`,
      stats: result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync fehlgeschlagen'
    return NextResponse.json({ ok: false, message: msg, fehler: msg }, { status: 502 })
  }
}

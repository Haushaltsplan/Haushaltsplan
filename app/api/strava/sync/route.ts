import { synchronisiereStravaAktivitaeten } from '@/lib/strava/strava-server'
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

    let fullImport = false
    try {
      const url = new URL(req.url)
      fullImport = url.searchParams.get('full') === '1'
      const body = (await req.clone().json().catch(() => null)) as { full?: boolean } | null
      if (body?.full) fullImport = true
    } catch {
      /* optional body */
    }

    const result = await synchronisiereStravaAktivitaeten(sb, { fullImport })

    const streamHint =
      result.streamsAnalysiert > 0
        ? `, ${result.streamsAnalysiert} Streams analysiert`
        : ''
    const weatherHint =
      result.wetterAngereichert > 0 ? `, ${result.wetterAngereichert} mit Wetter` : ''

    const segmentHint =
      result.segmenteGeladen > 0 ? `, ${result.segmenteGeladen} mit Segmenten` : ''

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      message: `${result.imported} Aktivitäten aktualisiert — ${result.total} gespeichert${streamHint}${weatherHint}${segmentHint}`,
      stats: result,
      fullImport,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync fehlgeschlagen'
    return NextResponse.json({ ok: false, message: msg, fehler: msg }, { status: 502 })
  }
}

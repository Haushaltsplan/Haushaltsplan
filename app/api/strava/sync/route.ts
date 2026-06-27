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
    let syncAll = false
    let connectionId: string | null = null

    try {
      const url = new URL(req.url)
      fullImport = url.searchParams.get('full') === '1'
      syncAll = url.searchParams.get('all') === '1'
      connectionId = url.searchParams.get('connection')
      const body = (await req.clone().json().catch(() => null)) as {
        full?: boolean
        syncAll?: boolean
        connectionId?: string
      } | null
      if (body?.full) fullImport = true
      if (body?.syncAll) syncAll = true
      if (body?.connectionId) connectionId = body.connectionId
    } catch {
      /* optional body */
    }

    const result = await synchronisiereStravaAktivitaeten(sb, {
      fullImport,
      syncAll,
      connectionId,
    })

    const streamHint =
      result.streamsAnalysiert > 0
        ? `, ${result.streamsAnalysiert} Streams analysiert`
        : ''
    const connHint =
      result.connectionsSynced > 1 ? ` (${result.connectionsSynced} Athleten)` : ''

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      message: `${result.imported} Aktivitäten aktualisiert — ${result.total} gespeichert${streamHint}${connHint}`,
      stats: result,
      fullImport,
      syncAll,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync fehlgeschlagen'
    return NextResponse.json({ ok: false, message: msg, fehler: msg }, { status: 502 })
  }
}

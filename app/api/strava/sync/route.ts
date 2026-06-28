import { synchronisiereStravaAktivitaeten } from '@/lib/strava/strava-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDatum(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSyncMessage(result: {
  imported: number
  total: number
  streamsAnalysiert: number
  wetterAngereichert: number
  segmenteGeladen: number
  newestInDb: string | null
  newestFromStrava: string | null
}): string {
  const parts = [`${result.imported} von Strava geladen — ${result.total} gespeichert`]
  if (result.streamsAnalysiert > 0) parts.push(`${result.streamsAnalysiert} Streams`)
  if (result.wetterAngereichert > 0) parts.push(`${result.wetterAngereichert} Wetter`)
  if (result.segmenteGeladen > 0) parts.push(`${result.segmenteGeladen} Segmente`)
  const neu = formatDatum(result.newestInDb)
  if (neu) parts.push(`neueste in DB: ${neu}`)
  const vonStrava = formatDatum(result.newestFromStrava)
  if (vonStrava && vonStrava !== neu) parts.push(`Strava lieferte bis: ${vonStrava}`)
  return parts.join(' · ')
}

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

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      message: formatSyncMessage(result),
      stats: result,
      fullImport,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync fehlgeschlagen'
    return NextResponse.json({ ok: false, message: msg, fehler: msg }, { status: 502 })
  }
}

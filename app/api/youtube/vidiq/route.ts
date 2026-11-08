import { NextResponse } from 'next/server'
import { createSupabaseFuerRequest, ownerUserIdAusRequest } from '@/lib/supabase-user'
import { videoIdAusText } from '@/lib/youtube/vidiq-engine'
import { VidiqFehler, ladeAnalytics, ladeNische, ladeVideo, pruefeRanking } from '@/lib/youtube/vidiq-youtube-server'
import { youtubeApiKonfiguriert } from '@/lib/youtube/youtube-oauth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fehler(e: unknown) {
  if (e instanceof VidiqFehler) {
    return NextResponse.json({ ok: false, error: e.message, brauchtReconnect: e.brauchtReconnect }, { status: e.brauchtReconnect ? 403 : 400 })
  }
  const msg = e instanceof Error ? e.message : 'VidIQ-Abruf fehlgeschlagen'
  const reconnect = /erneut verbinden/i.test(msg)
  return NextResponse.json({ ok: false, error: msg, brauchtReconnect: reconnect }, { status: reconnect ? 403 : 400 })
}

export async function POST(req: Request) {
  if (!youtubeApiKonfiguriert()) {
    return NextResponse.json({ ok: false, error: 'YouTube OAuth nicht konfiguriert.' }, { status: 501 })
  }
  const sb = createSupabaseFuerRequest(req)
  const owner = ownerUserIdAusRequest(req)
  if (!sb || !owner) return NextResponse.json({ ok: false, error: 'Anmeldung erforderlich.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const action = String(body.action ?? '')
  try {
    if (action === 'nische') {
      const ticker = String(body.ticker ?? '').trim()
      const firmenname = String(body.firmenname ?? '').trim()
      if (!ticker || !firmenname) return NextResponse.json({ ok: false, error: 'Ticker oder Firma fehlt.' }, { status: 400 })
      return NextResponse.json(await ladeNische({ ownerUserId: owner, ticker, firmenname, hook: String(body.hook ?? '') }))
    }
    if (action === 'video') {
      const videoId = videoIdAusText(String(body.video ?? ''))
      if (!videoId) return NextResponse.json({ ok: false, error: 'Keine Video-ID in dem Link.' }, { status: 400 })
      return NextResponse.json(await ladeVideo({ ownerUserId: owner, videoId }))
    }
    if (action === 'analytics') return NextResponse.json(await ladeAnalytics(owner))
    if (action === 'ranking') {
      const videoId = videoIdAusText(String(body.videoId ?? ''))
      const phrase = String(body.phrase ?? '').trim()
      if (!videoId || !phrase) return NextResponse.json({ ok: false, error: 'Video-ID oder Phrase fehlt.' }, { status: 400 })
      return NextResponse.json(await pruefeRanking({ ownerUserId: owner, videoId, phrase }))
    }
    return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return fehler(e)
  }
}

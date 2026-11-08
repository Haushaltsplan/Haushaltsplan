import { NextResponse } from 'next/server'
import { createSupabaseFuerRequest, ownerUserIdAusRequest } from '@/lib/supabase-user'
import { videoIdAusText } from '@/lib/youtube/vidiq-engine'
import { VidiqFehler, ladeAnalytics, ladeEigeneShorts, ladeKonkurrent, ladeNische, ladeRecherche, ladeSnippet, ladeVideo, pruefeRanking, schreibeVideoMeta } from '@/lib/youtube/vidiq-youtube-server'
import { erzeugeBeschreibung, erzeugeIdeen, erzeugeTags, erzeugeTitel } from '@/lib/youtube/vidiq-texte-server'
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
    if (action === 'liste') return NextResponse.json(await ladeEigeneShorts(owner))
    if (action === 'snippet') {
      const videoId = videoIdAusText(String(body.videoId ?? ''))
      if (!videoId) return NextResponse.json({ ok: false, error: 'Video fehlt.' }, { status: 400 })
      return NextResponse.json(await ladeSnippet({ ownerUserId: owner, videoId }))
    }
    if (action === 'keywords' || action === 'outlier') {
      const phrase = String(body.phrase ?? '').trim()
      if (!phrase) return NextResponse.json({ ok: false, error: 'Begriff fehlt.' }, { status: 400 })
      return NextResponse.json(await ladeRecherche({ ownerUserId: owner, phrase }))
    }
    if (action === 'konkurrent') {
      const eingabe = String(body.eingabe ?? '').trim()
      if (!eingabe) return NextResponse.json({ ok: false, error: 'Kanal fehlt.' }, { status: 400 })
      return NextResponse.json(await ladeKonkurrent({ ownerUserId: owner, eingabe }))
    }
    if (action === 'update') {
      const videoId = videoIdAusText(String(body.videoId ?? ''))
      const title = String(body.title ?? '').trim()
      const description = String(body.description ?? '')
      const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : []
      if (!videoId || !title) return NextResponse.json({ ok: false, error: 'Video oder Titel fehlt.' }, { status: 400 })
      return NextResponse.json(await schreibeVideoMeta({ ownerUserId: owner, videoId, title, description, tags }))
    }
    if (action === 'texte') {
      const art = String(body.art ?? '')
      const titel = String(body.titel ?? '')
      const beschreibung = String(body.beschreibung ?? '')
      const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : []
      if (art === 'titel') return NextResponse.json({ ok: true, titel: await erzeugeTitel({ titel, beschreibung, tags }) })
      if (art === 'tags') return NextResponse.json({ ok: true, tags: await erzeugeTags({ titel, beschreibung, tags }) })
      if (art === 'beschreibung') return NextResponse.json({ ok: true, beschreibung: await erzeugeBeschreibung({ titel, beschreibung, tags }) })
      return NextResponse.json({ ok: false, error: 'Unbekannte Textart.' }, { status: 400 })
    }
    if (action === 'ideen') {
      const begriffe = Array.isArray(body.begriffe) ? body.begriffe.map((t) => String(t)) : []
      const titel = Array.isArray(body.titel) ? body.titel.map((t) => String(t)) : []
      return NextResponse.json({ ok: true, ideen: await erzeugeIdeen({ begriffe, titel }) })
    }
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

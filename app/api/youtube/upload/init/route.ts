import { NextResponse } from 'next/server'
import { createSupabaseFuerRequest, ownerUserIdAusRequest } from '@/lib/supabase-user'
import { starteYoutubeUpload, type YoutubePrivacy } from '@/lib/youtube/youtube-upload-server'
import { youtubeApiKonfiguriert } from '@/lib/youtube/youtube-oauth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PRIVACY: YoutubePrivacy[] = ['unlisted', 'private', 'public']

export async function POST(req: Request) {
  if (!youtubeApiKonfiguriert()) {
    return NextResponse.json({ error: 'YouTube OAuth nicht konfiguriert.' }, { status: 501 })
  }
  const sb = createSupabaseFuerRequest(req)
  const owner = ownerUserIdAusRequest(req)
  if (!sb || !owner) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const dateigroesse = Number(body.dateigroesse)
  const privacy = PRIVACY.includes(body.privacy as YoutubePrivacy) ? (body.privacy as YoutubePrivacy) : 'unlisted'
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean) : []
  if (!title || title.length > 100) return NextResponse.json({ error: 'Titel fehlt oder ist zu lang.' }, { status: 400 })

  try {
    const { uploadUrl } = await starteYoutubeUpload({
      ownerUserId: owner,
      title,
      description,
      tags,
      privacy,
      dateigroesse,
      origin: new URL(req.url).origin,
    })
    return NextResponse.json({ ok: true, uploadUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload-Init fehlgeschlagen' }, { status: 400 })
  }
}

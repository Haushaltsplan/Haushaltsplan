import { NextResponse } from 'next/server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { speichereYoutubePending } from '@/lib/youtube/youtube-oauth-store'
import { baueYoutubeAuthUrl, erzeugeYoutubePkce, youtubeApiKonfiguriert } from '@/lib/youtube/youtube-oauth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!youtubeApiKonfiguriert()) {
    return NextResponse.json({ error: 'YouTube OAuth nicht konfiguriert (YOUTUBE_CLIENT_ID/SECRET).' }, { status: 501 })
  }
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const state = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    const { codeVerifier, codeChallenge } = erzeugeYoutubePkce()
    await speichereYoutubePending(state, user.id, codeVerifier)
    const origin = new URL(req.url).origin
    return NextResponse.json({ url: baueYoutubeAuthUrl(origin, state, codeChallenge) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'OAuth-Start fehlgeschlagen' }, { status: 500 })
  }
}

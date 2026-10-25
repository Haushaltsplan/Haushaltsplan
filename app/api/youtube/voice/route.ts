import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { moatShortSprechzeilen } from '@/lib/youtube/moat-short-voice'
import { elevenLabsKonfiguriert, erzeugeMoatShortStimme } from '@/lib/youtube/moat-short-voice-server'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ configured: elevenLabsKonfiguriert() })
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    if (!elevenLabsKonfiguriert()) {
      return { ok: false as const, fehler: 'ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID fehlen.' }
    }
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const props = body.props as MoatShortProps | undefined
    if (!props || typeof props !== 'object' || !props.hook) {
      return { ok: false as const, fehler: 'Script-Props fehlen.' }
    }
    const zeilen = moatShortSprechzeilen(props)
    if (zeilen.length < 3) return { ok: false as const, fehler: 'Zu wenig Sprechtext.' }
    try {
      const stimme = await erzeugeMoatShortStimme(zeilen)
      return { ok: true as const, ...stimme }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Stimme fehlgeschlagen' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

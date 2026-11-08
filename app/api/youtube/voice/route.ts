import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { earningsShortSprechzeilen } from '@/lib/youtube/earnings-short-voice'
import { sanitiereMoatFuerStimme } from '@/lib/youtube/moat-short-script'
import { moatShortSprechzeilen, tempoAusRegler } from '@/lib/youtube/moat-short-voice'
import { elevenLabsKonfiguriert, erzeugeMoatShortStimme, MOAT_STIMME_SPEED } from '@/lib/youtube/moat-short-voice-server'
import type { EarningsShortProps } from '@/remotion/earnings-short-types'
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
    const art = body.art === 'earnings' ? 'earnings' : 'moat'
    const props = body.props
    if (!props || typeof props !== 'object' || !('hook' in props)) {
      return { ok: false as const, fehler: 'Script-Props fehlen.' }
    }
    const moatProps = art === 'moat' ? sanitiereMoatFuerStimme(props as MoatShortProps) : null
    const zeilen =
      art === 'earnings'
        ? earningsShortSprechzeilen(props as EarningsShortProps)
        : moatShortSprechzeilen(moatProps ?? (props as MoatShortProps))
    if (zeilen.length < 3) return { ok: false as const, fehler: 'Zu wenig Sprechtext.' }
    const stimmeRoh = body.stimme
    const roh = stimmeRoh && typeof stimmeRoh === 'object' ? (stimmeRoh as Record<string, unknown>) : null
    const stimme = roh
      ? {
          stability: Number(roh.stability),
          similarity: Number(roh.similarity),
          style: Number(roh.style),
        }
      : undefined
    const pause = roh && Number.isFinite(Number(roh.pause)) ? Math.max(0, Math.min(100, Number(roh.pause))) : 0
    const betonung = roh && Number.isFinite(Number(roh.betonung)) ? Math.max(0, Math.min(100, Number(roh.betonung))) : 100
    const tempo = art === 'moat' ? tempoAusRegler(roh ? Number(roh.speed) : null, MOAT_STIMME_SPEED) : 1
    try {
      const audio = await erzeugeMoatShortStimme(zeilen, tempo, {
        regie: art === 'moat',
        stimme: art === 'moat' ? stimme : undefined,
        regieWerte: art === 'moat' ? { pause, betonung } : undefined,
      })
      return { ok: true as const, ...audio }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Stimme fehlgeschlagen' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

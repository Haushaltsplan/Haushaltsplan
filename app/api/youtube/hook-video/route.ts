import { NextResponse } from 'next/server'
import { fetchHookVideo } from '@/lib/hook-video-provider'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const ticker = String(body.ticker ?? '')
    const prompt = String(body.prompt ?? body.keyword ?? '')
    try {
      const src = await fetchHookVideo(prompt, ticker)
      return { ok: true as const, src, art: src.endsWith('.mp4') ? 'video' : 'bild' }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Hook-Video fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

/**
 * POST { props, feld, hinweis?, geschaeft? } — ein Script-Feld mit Free-Key nachziehen.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { optimiereScriptFeld, wendeOptimierungAn } from '@/lib/youtube/moat-script-optimizer-server'
import type { StudioFeldId } from '@/lib/youtube/moat-script-supervisor'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FELDER = new Set<StudioFeldId>([
  'kicker',
  'hook',
  'proof',
  'pillar0',
  'pillar1',
  'pillar2',
  'pillar3',
  'crack',
  'closing',
])

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const props = body.props as MoatShortProps | undefined
    const feld = body.feld as StudioFeldId
    if (!props || typeof props !== 'object' || !('hook' in props)) {
      return { ok: false as const, fehler: 'Script-Props fehlen.' }
    }
    if (!FELDER.has(feld)) return { ok: false as const, fehler: 'Unbekanntes Feld.' }
    try {
      const r = await optimiereScriptFeld({
        props,
        feld,
        hinweis: typeof body.hinweis === 'string' ? body.hinweis : undefined,
        geschaeft: typeof body.geschaeft === 'string' ? body.geschaeft : undefined,
      })
      return {
        ok: true as const,
        text: r.text,
        quelle: r.quelle,
        props: wendeOptimierungAn(props, feld, r.text),
      }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Optimierung fehlgeschlagen' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

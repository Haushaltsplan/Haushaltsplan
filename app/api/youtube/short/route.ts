/**
 * POST { paket, isin?, moatNeu? } — Moat-Urteil (Cache oder neu) + englisches Short-Script.
 */
import { NextResponse } from 'next/server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { jsonMitOwner } from '@/lib/request-owner'
import { generiereMoatShort } from '@/lib/youtube/moat-short-script-server'
import type { MoatShortAntwort } from '@/lib/youtube/moat-short-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 240

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async (): Promise<MoatShortAntwort> => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false, fehler: 'Kein gültiges JSON.' }
    }

    const paket = body.paket as FundamentaldatenPaket | undefined
    if (!paket || typeof paket !== 'object' || !Array.isArray(paket.keyMetrics) || !paket.firmenname) {
      return { ok: false, fehler: 'Fundamentaldaten-Paket fehlt oder ungültig.' }
    }

    try {
      const ergebnis = await generiereMoatShort({
        paket,
        isin: typeof body.isin === 'string' ? body.isin : null,
        moatNeu: body.moatNeu === true,
      })
      return { ok: true, ...ergebnis }
    } catch (e) {
      return { ok: false, fehler: e instanceof Error ? e.message : 'Short-Script fehlgeschlagen' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

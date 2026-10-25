/**
 * POST { ticker, firmenname?, isin? } — Beat/Miss + Call-KI aus Cache + englisches Earnings-Script.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { generiereEarningsShort } from '@/lib/youtube/earnings-short-script-server'
import type { EarningsShortAntwort } from '@/lib/youtube/earnings-short-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 240

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async (): Promise<EarningsShortAntwort> => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false, fehler: 'Kein gültiges JSON.' }
    }

    const ticker = typeof body.ticker === 'string' ? body.ticker.trim() : ''
    if (ticker.length < 1) return { ok: false, fehler: 'Ticker fehlt.' }

    try {
      return await generiereEarningsShort({
        ticker,
        firmenname: typeof body.firmenname === 'string' ? body.firmenname : null,
        isin: typeof body.isin === 'string' ? body.isin : null,
        website: typeof body.website === 'string' ? body.website : null,
        symbolYahoo: typeof body.symbolYahoo === 'string' ? body.symbolYahoo : null,
        estimateBilder: body.estimateBilder,
      })
    } catch (e) {
      return { ok: false, fehler: e instanceof Error ? e.message : 'Earnings-Script fehlgeschlagen' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

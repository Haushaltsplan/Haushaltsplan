/**
 * Ticker → ISIN (für Watchlist-Add ohne ISIN, z. B. Screener).
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { loeseIsinFuerTicker } from '@/lib/portfolio-analyse/ticker-isin-aufloesung-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return jsonMitOwner(req, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
    }
    const symbol = String((body as { symbol?: unknown })?.symbol ?? '').trim()
    if (!symbol) {
      return NextResponse.json({ ok: false, message: 'symbol fehlt.' }, { status: 400 })
    }
    try {
      const isin = await loeseIsinFuerTicker(symbol)
      if (!isin) return NextResponse.json({ ok: true, isin: null, name: null, symbolYahoo: symbol })
      const ken = isinKenntnis(isin)
      return NextResponse.json({
        ok: true,
        isin,
        name: ken?.name ?? null,
        symbolYahoo: ken?.symbolYahoo ?? symbol,
        symbolCandidates: ken?.symbolCandidates ?? [symbol],
      })
    } catch (e) {
      console.error('[ticker-isin]', e)
      return NextResponse.json(
        { ok: false, message: e instanceof Error ? e.message : 'Ticker-ISIN fehlgeschlagen.' },
        { status: 502 },
      )
    }
  })
}

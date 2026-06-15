import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { ladeMaterialEvents } = await import('@/lib/portfolio-analyse/material-events-server')
    const body = (await req.json()) as Record<string, unknown>
    const ticker = body.ticker != null ? String(body.ticker).trim() : ''
    if (!ticker) {
      return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
    }
    const paket = await ladeMaterialEvents({
      ticker,
      firmenname: body.firmenname != null ? String(body.firmenname) : null,
      isin: body.isin != null ? String(body.isin).trim() || null : null,
      force: Boolean(body.force),
    })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('material-events', e)
    return NextResponse.json(
      { ok: false, ticker: '', events: [], geladenAm: new Date().toISOString(), fehler: e instanceof Error ? e.message : 'Fehler' },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { ladeCapitalAllocation } = await import('@/lib/portfolio-analyse/capital-allocation-server')
    const body = (await req.json()) as Record<string, unknown>
    const ticker = body.ticker != null ? String(body.ticker).trim() : ''
    if (!ticker) {
      return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
    }
    const paket = await ladeCapitalAllocation({
      ticker,
      symbolYahoo: body.symbolYahoo != null ? String(body.symbolYahoo).trim() || null : null,
      force: Boolean(body.force),
    })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('capital-allocation', e)
    return NextResponse.json(
      {
        ok: false,
        ticker: '',
        periodeLabel: null,
        ocfMioUsd: null,
        fcfMioUsd: null,
        umsatzMioUsd: null,
        saeulen: [],
        scorePct: null,
        scoreLabel: 'keine_daten',
        scoreHinweis: '',
        geladenAm: new Date().toISOString(),
        fehler: e instanceof Error ? e.message : 'Fehler',
      },
      { status: 500 },
    )
  }
}

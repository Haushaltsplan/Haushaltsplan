import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { ladeInsiderTransaktionen } = await import('@/lib/portfolio-analyse/insider-transaktionen-server')
    const body = (await req.json()) as Record<string, unknown>
    const ticker = body.ticker != null ? String(body.ticker).trim() : ''
    if (!ticker) {
      return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
    }
    const paket = await ladeInsiderTransaktionen({
      ticker,
      symbolYahoo: body.symbolYahoo != null ? String(body.symbolYahoo).trim() || null : null,
      isin: body.isin != null ? String(body.isin).trim() || null : null,
      firmenname: body.firmenname != null ? String(body.firmenname) : null,
      force: Boolean(body.force),
    })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('insider-transaktionen', e)
    return NextResponse.json(
      {
        ok: false,
        ticker: '',
        transaktionen: [],
        kaufSummeUsd: null,
        verkaufSummeUsd: null,
        nettoKaufUsd: null,
        geladenAm: new Date().toISOString(),
        hinweis: null,
        fehler: e instanceof Error ? e.message : 'Fehler',
      },
      { status: 500 },
    )
  }
}

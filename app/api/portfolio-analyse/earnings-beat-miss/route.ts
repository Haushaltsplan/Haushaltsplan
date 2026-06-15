import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { ladeEarningsBeatMissHistorie } = await import(
      '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
    )
    const body = (await req.json()) as Record<string, unknown>
    const ticker = body.ticker != null ? String(body.ticker).trim() : ''
    if (!ticker) {
      return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
    }
    const paket = await ladeEarningsBeatMissHistorie({
      ticker,
      symbolYahoo: body.symbolYahoo != null ? String(body.symbolYahoo).trim() || null : null,
      isin: body.isin != null ? String(body.isin).trim() || null : null,
      limit: body.limit != null ? Number(body.limit) : 8,
      force: Boolean(body.force),
    })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('earnings-beat-miss', e)
    return NextResponse.json(
      {
        ok: false,
        ticker: '',
        quelle: null,
        quartale: [],
        epsBeatRatePct: null,
        umsatzBeatRatePct: null,
        epsBeats: 0,
        umsatzBeats: 0,
        bewertbarEps: 0,
        bewertbarUmsatz: 0,
        guidanceHinweis: '',
        geladenAm: new Date().toISOString(),
        fehler: e instanceof Error ? e.message : 'Fehler',
      },
      { status: 500 },
    )
  }
}

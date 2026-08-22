import { NextResponse } from 'next/server'
import { ladePortfolioKorrelation } from '@/lib/portfolio-analyse/portfolio-korrelation-server'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST { ticker: string[], beta?: Record<string, number|null> } */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      ticker?: string[]
      beta?: Record<string, number | null>
    }
    const ticker = Array.isArray(body.ticker) ? body.ticker : []
    if (ticker.length < 2) {
      return NextResponse.json(
        { ok: false, fehler: 'Mindestens 2 Ticker erforderlich.' },
        { status: 400 },
      )
    }
    const paket = await ladePortfolioKorrelation({
      ticker,
      beta: body.beta,
    })
    return NextResponse.json(paket)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Korrelation fehlgeschlagen'
    return NextResponse.json({ ok: false, fehler: msg }, { status: 500 })
  }
}

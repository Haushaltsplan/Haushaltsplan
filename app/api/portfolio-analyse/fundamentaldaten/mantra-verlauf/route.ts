import { NextResponse } from 'next/server'
import { ladeMantraVerlauf } from '@/lib/portfolio-analyse/mantra-verlauf-server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker')?.trim().toUpperCase()
  if (!ticker) {
    return NextResponse.json({ ok: false, message: 'Parameter ticker fehlt.' }, { status: 400 })
  }

  const verlauf = await ladeMantraVerlauf(ticker)
  return NextResponse.json({ ok: true, ticker, verlauf })
}

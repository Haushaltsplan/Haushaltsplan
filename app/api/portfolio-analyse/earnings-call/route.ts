import { ladeEarningsCallZusammenfassung } from '@/lib/portfolio-analyse/earnings-call-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Playwright-Scrape + KI-Zusammenfassung kann mehrere Minuten dauern. */
export const maxDuration = 180

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = body as Record<string, unknown>
  const ticker = row.ticker != null ? String(row.ticker).trim() : ''
  if (!ticker) {
    return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
  }

  const paket = await ladeEarningsCallZusammenfassung({
    ticker,
    firmenname: row.firmenname != null ? String(row.firmenname) : null,
    isin: row.isin != null ? String(row.isin).trim() || null : null,
    force: Boolean(row.force),
    quartalId: row.quartalId != null ? String(row.quartalId).trim() || null : null,
  })

  if (!paket.ok && paket.quartale.length === 0) {
    return NextResponse.json(paket, { status: 502 })
  }
  return NextResponse.json(paket)
}

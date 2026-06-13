import type { SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

function leerPaket(ticker: string, fehler: string): SecBerichtePaket {
  return {
    ok: false,
    ticker,
    berichte: [],
    aktiverBerichtId: null,
    geladenAm: new Date().toISOString(),
    ausCache: false,
    fehler,
  }
}

export async function POST(req: Request) {
  let ticker = ''
  try {
    const { ladeSecBerichte } = await import('@/lib/portfolio-analyse/sec-berichte-server')

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
    }

    const row = body as Record<string, unknown>
    ticker = row.ticker != null ? String(row.ticker).trim() : ''
    if (!ticker) {
      return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
    }

    const paket = await ladeSecBerichte({
      ticker,
      firmenname: row.firmenname != null ? String(row.firmenname) : null,
      isin: row.isin != null ? String(row.isin).trim() || null : null,
      force: Boolean(row.force),
      accession: row.accession != null ? String(row.accession).trim() || null : null,
      berichtId: row.berichtId != null ? String(row.berichtId).trim() || null : null,
      forceKi: Boolean(row.forceKi),
    })

    return NextResponse.json(paket)
  } catch (e) {
    console.error('sec-berichte', e)
    const raw = e instanceof Error ? e.message : 'Interner Serverfehler'
    return NextResponse.json(leerPaket(ticker, raw))
  }
}

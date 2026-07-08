import { NextResponse } from 'next/server'

import { ladeMarketscreenerSegmentHistorie } from '@/lib/portfolio-analyse/marketscreener-segment-historie-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET ?isin=…&name=…&symbol=GOOGL — Marketscreener-Segment-Historie (Geo/Produkt). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const isin = url.searchParams.get('isin')?.trim() || null
  const name = url.searchParams.get('name')?.trim() || 'Unbekannt'
  const symbol = url.searchParams.get('symbol')?.trim() || null
  const ticker = url.searchParams.get('ticker')?.trim() || null

  if (!isin && !symbol && !ticker) {
    return NextResponse.json({ ok: false, fehler: 'isin oder symbol erforderlich.' }, { status: 400 })
  }

  try {
    const paket = await ladeMarketscreenerSegmentHistorie({
      isin,
      name,
      symbolYahoo: symbol,
      ticker,
    })
    if (!paket) {
      return NextResponse.json({ ok: false, paket: null, fehler: 'Keine Segmentdaten gefunden.' })
    }
    return NextResponse.json({ ok: true, paket })
  } catch (e) {
    console.error('marketscreener-segmente', e)
    return NextResponse.json({ ok: false, fehler: 'Abruf fehlgeschlagen.' }, { status: 502 })
  }
}

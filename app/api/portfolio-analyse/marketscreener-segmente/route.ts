import { NextResponse } from 'next/server'

import { ladeGescrapteSegmentStruktur } from '@/lib/portfolio-analyse/segment-struktur-scraper-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET ?isin=…&name=…&symbol=GOOGL&refresh=1 — Segment/Region + Backlog (nur Scraper). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const isin = url.searchParams.get('isin')?.trim() || null
  const name = url.searchParams.get('name')?.trim() || 'Unbekannt'
  const symbol = url.searchParams.get('symbol')?.trim() || null
  const ticker = url.searchParams.get('ticker')?.trim() || null
  const refresh = url.searchParams.get('refresh') === '1'

  if (!isin && !symbol && !ticker) {
    return NextResponse.json({ ok: false, fehler: 'isin oder symbol erforderlich.' }, { status: 400 })
  }

  try {
    const paket = await ladeGescrapteSegmentStruktur({
      isin,
      name,
      symbolYahoo: symbol,
      ticker,
      refresh,
    })
    if (!paket) {
      return NextResponse.json(
        {
          ok: false,
          paket: null,
          fehler:
            'Keine Segment- oder Backlog-Daten gefunden. Marketscreener blockiert Server-IPs — bitte einmal lokal `npx tsx scripts/seed-segment-struktur-cloud.ts` ausführen.',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return NextResponse.json(
      { ok: true, paket },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('marketscreener-segmente', e)
    return NextResponse.json({ ok: false, fehler: 'Abruf fehlgeschlagen.' }, { status: 502 })
  }
}

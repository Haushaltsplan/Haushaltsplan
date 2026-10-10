import { NextResponse } from 'next/server'

import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { segmentPaketPlausibel } from '@/lib/portfolio-analyse/segment-historie-merge-hilfen'
import { ladeSegmentStrukturAusCloud } from '@/lib/portfolio-analyse/segment-struktur-cloud-server'
import { ladeGescrapteSegmentStruktur } from '@/lib/portfolio-analyse/segment-struktur-scraper-server'
import { repariereSegmentPaket } from '@/lib/portfolio-analyse/segment-umsatz-abgleich'

export const dynamic = 'force-dynamic'
/** SEC-Live-Scrape bei Cold Cache kann >60s dauern — UI bricht bei Wechsel per Abort ab. */
export const maxDuration = 180

/** GET ?isin=…&name=…&symbol=GOOGL&refresh=1&preferCache=1 — Segment/Region + Backlog. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const isinRaw = url.searchParams.get('isin')?.trim() || null
  const name = url.searchParams.get('name')?.trim() || 'Unbekannt'
  const symbol = url.searchParams.get('symbol')?.trim() || null
  const ticker = url.searchParams.get('ticker')?.trim() || null
  const refresh = url.searchParams.get('refresh') === '1'
  const preferCache = url.searchParams.get('preferCache') === '1'

  if (!isinRaw && !symbol && !ticker) {
    return NextResponse.json({ ok: false, fehler: 'isin oder symbol erforderlich.' }, { status: 400 })
  }

  const isin =
    loesePortfolioIsin({
      isin: isinRaw,
      symbolYahoo: symbol,
      ticker,
      firmenname: name,
    }) ?? isinRaw

  try {
    const erwarteterTicker = (ticker || symbol || '').trim().toUpperCase().split('.')[0] || null

    // Firmenwechsel / Normalfall: NUR Cloud — nie Live-Scrape (der braucht Minuten).
    if (preferCache && !refresh) {
      if (isin && isin.length >= 10) {
        const cloud = await ladeSegmentStrukturAusCloud(isin, {
          erwarteterTicker,
        })
        if (
          cloud &&
          segmentPaketPlausibel(cloud, {
            ticker: erwarteterTicker,
            name,
            isin,
          })
        ) {
          const paket = repariereSegmentPaket(cloud) ?? cloud
          return NextResponse.json(
            { ok: true, paket, ausCache: true },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        }
      }
      return NextResponse.json(
        {
          ok: false,
          paket: null,
          ausCache: true,
          fehler: 'Kein Segment-Cache für diesen Titel. Einmal „Aktualisieren“ tippen.',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const paket = await ladeGescrapteSegmentStruktur({
      isin,
      name,
      symbolYahoo: symbol,
      ticker,
      refresh,
    })
    if (
      !paket ||
      !segmentPaketPlausibel(paket, {
        ticker: erwarteterTicker,
        name,
        isin,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          paket: null,
          fehler: paket
            ? 'Segmentdaten passen nicht zu diesem Titel (Cache-Bleed verworfen).'
            : 'Keine Segment- oder Backlog-Daten gefunden. Marketscreener blockiert Server-IPs — bitte einmal lokal `npx tsx scripts/seed-segment-struktur-cloud.ts` ausführen.',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return NextResponse.json(
      { ok: true, paket, ausCache: false },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('marketscreener-segmente', e)
    return NextResponse.json({ ok: false, fehler: 'Abruf fehlgeschlagen.' }, { status: 502 })
  }
}

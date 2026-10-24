/**
 * Same-Origin-Logo für Vorschau und Browser-Export.
 * Nur erlaubte Logo-Hosts (Finnhub, MarketCap, FMP) — kein offener Proxy.
 */
import { NextResponse } from 'next/server'
import { istErlaubteLogoQuelle, ladeLogoProxy } from '@/lib/youtube/moat-short-logo-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('u') ?? ''
  if (!istErlaubteLogoQuelle(url)) {
    return NextResponse.json({ ok: false, fehler: 'Logo-Quelle nicht erlaubt.' }, { status: 400 })
  }
  const bild = await ladeLogoProxy(url)
  if (!bild) {
    return NextResponse.json({ ok: false, fehler: 'Logo nicht ladbar.' }, { status: 404 })
  }
  return new NextResponse(new Uint8Array(bild.bytes), {
    headers: {
      'Content-Type': bild.typ,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

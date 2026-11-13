import { NextResponse } from 'next/server'
import { hookBildLesen } from '@/lib/hook-video-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Gleiche Origin wie die App, damit der Film das Bild zeichnen kann. */
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker') ?? ''
  try {
    const bild = await hookBildLesen(ticker)
    if (!bild) return NextResponse.json({ fehler: 'Kein Hook-Bild.' }, { status: 404 })
    return new NextResponse(new Uint8Array(bild.bytes), {
      headers: {
        'Content-Type': bild.mime,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    const fehler = e instanceof Error ? e.message : 'Hook-Bild fehlt.'
    return NextResponse.json({ fehler }, { status: 400 })
  }
}

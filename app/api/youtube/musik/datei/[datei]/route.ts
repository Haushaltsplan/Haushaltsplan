/**
 * Liefert einen Katalog-Track (lokal oder von incompetech). Öffentlich, damit
 * <audio> und der Remotion-Player ohne Bearer-Header spielen können.
 */
import { NextResponse } from 'next/server'
import { istMusikDateiname, ladeMusikdatei } from '@/lib/youtube/moat-short-musik-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, ctx: { params: Promise<{ datei: string }> }) {
  const datei = decodeURIComponent((await ctx.params).datei)
  if (!istMusikDateiname(datei)) {
    return NextResponse.json({ ok: false, fehler: 'Unbekannter Track.' }, { status: 400 })
  }
  const treffer = await ladeMusikdatei(datei)
  if (!treffer) {
    return NextResponse.json({ ok: false, fehler: 'Track nicht ladbar.' }, { status: 404 })
  }
  return new NextResponse(new Uint8Array(treffer.bytes), {
    headers: {
      'Content-Type': treffer.typ,
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `inline; filename="${datei}"`,
    },
  })
}

/**
 * Nur lokal: POST startet den Remotion-Render, GET fragt den Stand ab bzw. liefert die MP4.
 * Auf Vercel gibt es keinen Browser/FFmpeg für Remotion — dort 501.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import {
  istMoatShortDateiname,
  leseRenderDatei,
  leseRenderStatus,
  starteMoatShortRender,
} from '@/lib/youtube/moat-short-render-server'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function nurLokal(): NextResponse | null {
  const env = process.env.VERCEL_ENV
  if (env !== 'production' && env !== 'preview') return null
  return NextResponse.json(
    {
      ok: false,
      fehler:
        'Du bist auf der Online-Seite. MP4-Export geht nur lokal: im Projektordner „npm run dev“ und dann http://localhost:3000/youtube öffnen.',
    },
    { status: 501 },
  )
}

export async function POST(req: Request) {
  const gesperrt = nurLokal()
  if (gesperrt) return gesperrt

  const out = await jsonMitOwner(req, async () => {
    let props: MoatShortProps
    try {
      props = ((await req.json()) as { props: MoatShortProps }).props
    } catch {
      return NextResponse.json({ ok: false, status: 'fehler', fehler: 'Kein gültiges JSON.' }, { status: 400 })
    }
    if (!props?.ticker || !Array.isArray(props.pillars)) {
      return NextResponse.json({ ok: false, status: 'fehler', fehler: 'Short-Daten fehlen.' }, { status: 400 })
    }
    const { dateiname } = await starteMoatShortRender(props)
    return NextResponse.json({ ok: true, status: 'laeuft', dateiname, sekunden: 0 })
  })
  return out instanceof NextResponse ? out : NextResponse.json(out)
}

export async function GET(req: Request) {
  const gesperrt = nurLokal()
  if (gesperrt) return gesperrt

  const out = await jsonMitOwner(req, async () => {
    const url = new URL(req.url)
    const dateiname = url.searchParams.get('datei') ?? ''
    const download = url.searchParams.get('download') === '1'
    if (!dateiname) {
      return NextResponse.json({ ok: true, lokal: true })
    }
    if (!istMoatShortDateiname(dateiname)) {
      return NextResponse.json({ ok: false, status: 'fehler', fehler: 'Ungültiger Dateiname.' }, { status: 400 })
    }
    const stand = await leseRenderStatus(dateiname)
    if (stand.status === 'fertig' && download) {
      const mp4 = await leseRenderDatei(dateiname)
      if (!mp4) {
        return NextResponse.json({ ok: false, status: 'fehler', fehler: 'MP4 fehlt auf der Platte.' }, { status: 404 })
      }
      return new NextResponse(new Uint8Array(mp4), {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${dateiname}"`,
        },
      })
    }
    return NextResponse.json(stand, { status: stand.ok ? 200 : 500 })
  })
  return out instanceof NextResponse ? out : NextResponse.json(out)
}

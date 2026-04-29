import { NextResponse } from 'next/server'
import { baueGpxTrack } from '@/lib/gpx-bauber'

export const runtime = 'nodejs'

type Body = {
  trackName?: unknown
  punkte?: Array<{ lat?: unknown; lng?: unknown }>
}

function toNum(v: unknown): number {
  return typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''))
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungueltiges JSON.' }, { status: 400 })
  }

  const punkte = (Array.isArray(body.punkte) ? body.punkte : [])
    .map((p) => ({ lat: toNum(p.lat), lng: toNum(p.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  if (punkte.length < 2) {
    return NextResponse.json({ error: 'Mindestens 2 Punkte erforderlich.' }, { status: 400 })
  }

  const trackName =
    typeof body.trackName === 'string' && body.trackName.trim().length
      ? body.trackName.trim().slice(0, 120)
      : 'Omnia Rennradroute'

  const gpx = baueGpxTrack({ trackName, punkte })
  const safeFile = trackName.replace(/[^\w\s\-äöüÄÖÜß]+/gi, '_').slice(0, 80) || 'route'
  return new NextResponse(gpx, {
    status: 200,
    headers: {
      'Content-Type': 'application/gpx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFile}.gpx"`,
    },
  })
}

import { NextResponse } from 'next/server'
import { baueGpxTrack } from '@/lib/gpx-bauber'

export const runtime = 'nodejs'

const MAX_WEGEPUNKTE = 14

function istGueltigeKoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

type Body = {
  /** Mind. 2 Punkte [Start … Ziel], Reihenfolge der Fahrt */
  waypoints?: Array<{ lat: unknown; lng: unknown }>
  trackName?: unknown
}

/**
 * OSRM öffentlicher Demo-Server — Profil „cycling“ (Straßenrouting für Rad).
 * Hinweis: Keine Garantie / Limits — für Produktion ggf. eigenes OSRM nutzen.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON.' }, { status: 400 })
  }

  const raw = Array.isArray(body.waypoints) ? body.waypoints : []
  const waypoints: Array<{ lat: number; lng: number }> = []
  for (const w of raw) {
    const lat = typeof w.lat === 'number' ? w.lat : Number.parseFloat(String(w.lat ?? ''))
    const lng = typeof w.lng === 'number' ? w.lng : Number.parseFloat(String(w.lng ?? ''))
    if (!istGueltigeKoordinate(lat, lng)) continue
    waypoints.push({ lat, lng })
  }

  if (waypoints.length < 2) {
    return NextResponse.json({ error: 'Mindestens zwei gültige Wegpunkte (Start und Ziel).' }, { status: 400 })
  }
  if (waypoints.length > MAX_WEGEPUNKTE) {
    return NextResponse.json({ error: `Maximal ${MAX_WEGEPUNKTE} Wegpunkte.` }, { status: 400 })
  }

  const koordinatenPfad = waypoints.map((p) => `${p.lng},${p.lat}`).join(';')
  const osrmUrl = `https://router.project-osrm.org/route/v1/cycling/${koordinatenPfad}?overview=full&geometries=geojson`

  try {
    const osrmRes = await fetch(osrmUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const osrmJson = (await osrmRes.json()) as {
      code?: string
      routes?: Array<{ geometry?: { coordinates?: number[][] } }>
    }

    if (!osrmRes.ok || osrmJson.code !== 'Ok' || !osrmJson.routes?.[0]?.geometry?.coordinates) {
      const hinweis =
        osrmJson.code === 'NoRoute'
          ? 'Für diese Punkte konnte keine Radstrecke berechnet werden (zu weit außerhalb des Straßennetzes?).'
          : 'Routing fehlgeschlagen.'
      return NextResponse.json({ error: hinweis }, { status: 422 })
    }

    const coords = osrmJson.routes[0].geometry!.coordinates!
    const punkte = coords.map(([lng, lat]) => ({
      lat,
      lng,
    }))

    const trackName =
      typeof body.trackName === 'string' && body.trackName.trim().slice(0, 120)
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
  } catch (e) {
    console.error('radroute/gpx', e)
    return NextResponse.json({ error: 'Routing oder GPX-Erstellung fehlgeschlagen.' }, { status: 502 })
  }
}

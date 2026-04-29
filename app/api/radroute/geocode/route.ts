import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Proxy für Nominatim — Browser-CORS umgehen, festes User-Agent für Nutzungsbedingungen */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Bitte mindestens zwei Zeichen eingeben.' }, { status: 400 })
  }
  if (q.length > 200) {
    return NextResponse.json({ error: 'Suchbegriff zu lang.' }, { status: 400 })
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=0`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'OmniaHaushaltRadroute/1.0 (Privatnutzung; kein Crawling)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Geocoding fehlgeschlagen (${res.status}).` }, { status: 502 })
    }
    const raw = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
    const treffer = raw
      .map((r) => {
        const lat = Number.parseFloat(String(r.lat ?? ''))
        const lon = Number.parseFloat(String(r.lon ?? ''))
        const display_name = typeof r.display_name === 'string' ? r.display_name : ''
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
        return { lat, lng: lon, display_name }
      })
      .filter((x): x is { lat: number; lng: number; display_name: string } => x !== null && x.display_name.length > 0)

    return NextResponse.json({ treffer })
  } catch (e) {
    console.error('radroute/geocode', e)
    return NextResponse.json({ error: 'Netzwerkfehler beim Geocoding.' }, { status: 502 })
  }
}

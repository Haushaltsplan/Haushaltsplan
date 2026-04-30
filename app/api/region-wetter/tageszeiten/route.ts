import { ladeTageszeitenFuerTag } from '@/lib/region-wetter-tageszeiten'
import { parseWetterOrtId, wetterOrtKoordinaten } from '@/lib/region-haarbach'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const datum = request.nextUrl.searchParams.get('datum')?.trim()
  if (!datum) {
    return NextResponse.json({ fehler: 'Parameter „datum“ fehlt (YYYY-MM-DD)' }, { status: 400 })
  }

  const ortId = parseWetterOrtId(request.nextUrl.searchParams.get('ort'))
  const { lat, lon } = wetterOrtKoordinaten(ortId)
  const r = await ladeTageszeitenFuerTag(datum, { lat, lon })
  if (r.fehler) {
    return NextResponse.json(r, { status: 502 })
  }
  return NextResponse.json(r)
}

import { ladeTageszeitenFuerTag } from '@/lib/region-wetter-tageszeiten'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const datum = request.nextUrl.searchParams.get('datum')?.trim()
  if (!datum) {
    return NextResponse.json({ fehler: 'Parameter „datum“ fehlt (YYYY-MM-DD)' }, { status: 400 })
  }

  const r = await ladeTageszeitenFuerTag(datum)
  if (r.fehler) {
    return NextResponse.json(r, { status: 502 })
  }
  return NextResponse.json(r)
}

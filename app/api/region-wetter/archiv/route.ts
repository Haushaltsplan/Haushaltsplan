import {
  isoZuDatumAnzeigeDe,
  ladeWetterArchivTag,
  parseWetterOrtId,
  wetterOrtKoordinaten,
  WETTER_ARCHIV_DATUM_MIN,
  heuteIsoEuropeBerlin,
} from '@/lib/region-haarbach'
import { NextResponse, type NextRequest } from 'next/server'

const DATUM = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const datum = request.nextUrl.searchParams.get('datum')?.trim()
  if (!datum || !DATUM.test(datum)) {
    return NextResponse.json({ fehler: 'Parameter „datum“ ungültig (YYYY-MM-DD)' }, { status: 400 })
  }

  const heute = heuteIsoEuropeBerlin()
  if (datum < WETTER_ARCHIV_DATUM_MIN || datum > heute) {
    return NextResponse.json(
      { fehler: `Datum außerhalb des Archivbereichs (${WETTER_ARCHIV_DATUM_MIN} … ${heute})` },
      { status: 400 },
    )
  }

  const ortId = parseWetterOrtId(request.nextUrl.searchParams.get('ort'))
  const { lat, lon } = wetterOrtKoordinaten(ortId)

  const tag = await ladeWetterArchivTag(lat, lon, datum, isoZuDatumAnzeigeDe(datum))
  return NextResponse.json({ tag })
}

import { NextResponse } from 'next/server'

import { ladeSnapshot, ladeEinstellung } from '@/lib/angebote/db'
import { isoWoche, normalisierePlz } from '@/lib/angebote/http'
import { filterUndSortiere } from '@/lib/angebote/normalisierung'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async (ownerUserId) => {
    const url = new URL(req.url)
    const qPlz = url.searchParams.get('plz')
    const einstellung = await ladeEinstellung(ownerUserId)
    const plz = normalisierePlz(qPlz || einstellung?.plz || '')
    if (!plz) {
      return NextResponse.json(
        { ok: false, error: 'Keine PLZ — bitte zuerst speichern oder ?plz= angeben.' },
        { status: 400 },
      )
    }
    const woche = isoWoche()
    const snap = await ladeSnapshot(plz, woche, ownerUserId)
    if (!snap) {
      return NextResponse.json({
        ok: true,
        vorhanden: false,
        plz,
        woche,
        angebote: [],
        quellen: [],
        maerkte: [],
      })
    }
    const q = url.searchParams.get('q') || undefined
    const sortParam = url.searchParams.get('sort')
    const sort =
      sortParam === 'preis' ||
      sortParam === 'grundpreis' ||
      sortParam === 'haendler' ||
      sortParam === 'name'
        ? sortParam
        : 'preis'
    return {
      ok: true,
      vorhanden: true,
      plz: snap.plz,
      woche: snap.woche,
      ausCache: true,
      angebote: filterUndSortiere(snap.angebote, { q, sort }),
      quellen: snap.quellen,
      maerkte: snap.maerkte,
      erstelltAm: snap.erstelltAm,
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

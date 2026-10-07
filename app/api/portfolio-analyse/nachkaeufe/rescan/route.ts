/**
 * Einzel-Rescan: Scannt einen Titel aus dem aktuellen Universum
 * (Whitelist ∪ Depot ∪ Watchlist) neu und persistiert das Ergebnis.
 * POST /api/portfolio-analyse/nachkaeufe/rescan
 * Body: { ticker?: string; isin?: string }
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { analyseTickerFuerPosition } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  return jsonMitOwner(req, async () => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = (body ?? {}) as Record<string, unknown>
  const ticker = row.ticker != null ? String(row.ticker).trim().toUpperCase() : ''
  const isin = row.isin != null ? String(row.isin).trim().toUpperCase() : ''

  const kandidaten = await ladeNachkaufKandidaten()
  const position = kandidaten.find((p) => {
    if (isin && p.isin.toUpperCase() === isin) return true
    if (!ticker) return false
    const sym = analyseTickerFuerPosition(p.isin, p.symbolYahoo).toUpperCase()
    return sym === ticker || (p.symbolYahoo?.toUpperCase() ?? '').startsWith(ticker)
  })

  if (!position) {
    return NextResponse.json(
      {
        ok: false,
        fehler: `Kein Radar-Kandidat (Whitelist/Depot/Watchlist) für ticker="${ticker}" oder isin="${isin}".`,
      },
      { status: 404 },
    )
  }

  try {
    const ergebnis = await laufeScan({
      erzwinge: true,
      nurEinenTicker: position.isin,
    })
    return NextResponse.json({
      ok: true,
      ticker: position.name,
      isin: position.isin,
      gescannt: ergebnis.gescannt,
      zeitstempel: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[api/nachkaeufe/rescan]', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
  })
}

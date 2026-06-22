/**
 * Einzel-Rescan: Scannt einen einzelnen Whitelist-Titel neu und persistiert das Ergebnis.
 * POST /api/portfolio-analyse/nachkaeufe/rescan
 * Body: { ticker?: string; isin?: string }
 */
import { NextResponse } from 'next/server'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'
import { NACHKAUF_RADAR_WHITELIST } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = (body ?? {}) as Record<string, unknown>
  const ticker = row.ticker != null ? String(row.ticker).trim().toUpperCase() : ''
  const isin = row.isin != null ? String(row.isin).trim().toUpperCase() : ''

  const position = NACHKAUF_RADAR_WHITELIST.find(
    (p) =>
      (ticker && p.name.toUpperCase().includes(ticker)) ||
      (isin && p.isin.toUpperCase() === isin),
  )

  if (!position) {
    return NextResponse.json(
      { ok: false, fehler: `Kein Whitelist-Eintrag für ticker="${ticker}" oder isin="${isin}" gefunden.` },
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
}

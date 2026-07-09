import { NextResponse } from 'next/server'
import { fuhreDeepResearchDurch } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-deep-research-server'
import { ladeNachkaufScanAusCloud } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { NACHKAUF_RADAR_WHITELIST } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { NachkaufDeepResearchAnfrage, NachkaufScanEintrag } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = (body ?? {}) as Record<string, unknown>
  const ticker = row.ticker != null ? String(row.ticker).trim() : ''
  if (!ticker) {
    return NextResponse.json({ ok: false, fehler: 'ticker fehlt.' }, { status: 400 })
  }

  const anfrage: NachkaufDeepResearchAnfrage = {
    ticker,
    isin: row.isin != null ? String(row.isin).trim() || null : null,
    name: row.name != null ? String(row.name).trim() || null : null,
  }

  let scanEintrag: NachkaufScanEintrag | null = null
  let historischerMedianPe: number | null | undefined

  try {
    const alleEintraege = await ladeNachkaufScanAusCloud()
    scanEintrag =
      alleEintraege.find(
        (e) => e.ticker.toUpperCase() === ticker.toUpperCase() || e.isin === (anfrage.isin ?? ''),
      ) ?? null

    if (scanEintrag) {
      historischerMedianPe =
        scanEintrag.bewertung.historischerMedianPe ??
        NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === scanEintrag!.isin)?.historischerMedianPe ??
        null
    } else {
      const wl = NACHKAUF_RADAR_WHITELIST.find(
        (p) => p.isin === (anfrage.isin ?? '') || p.name.toLowerCase().includes(ticker.toLowerCase()),
      )
      historischerMedianPe = wl?.historischerMedianPe ?? null
    }
  } catch {
    // Kontext optional — Deep Research darf nicht blockieren
  }

  try {
    const result = await fuhreDeepResearchDurch({ ...anfrage, scanEintrag, historischerMedianPe })
    if (!result.ok) {
      return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 502 })
    }
    return NextResponse.json({ ok: true, dr: result.dr })
  } catch (e) {
    console.error('[api/nachkaeufe/deep-research]', e)
    return NextResponse.json({ ok: false, fehler: 'Deep Research fehlgeschlagen.' }, { status: 502 })
  }
}

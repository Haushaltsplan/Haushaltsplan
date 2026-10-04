import { NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import { nachkaufDeepResearchBodySchema } from '@/lib/api/schemas/nachkauf'
import { jsonMitOwner } from '@/lib/request-owner'
import { fuhreDeepResearchDurch } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-deep-research-server'
import { ladeNachkaufScanAusCloud } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { NACHKAUF_RADAR_WHITELIST } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { NachkaufDeepResearchAnfrage, NachkaufScanEintrag } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  return jsonMitOwner(req, async () => {
  const parsed = await parseJsonBody(req, nachkaufDeepResearchBodySchema, {
    fehlerPrefix: 'Deep Research ungültig',
  })
  if (!parsed.ok) return parsed.response

  const ticker = parsed.data.ticker
  const anfrage: NachkaufDeepResearchAnfrage = {
    ticker,
    isin: parsed.data.isin ?? null,
    name: parsed.data.name ?? null,
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
  })
}

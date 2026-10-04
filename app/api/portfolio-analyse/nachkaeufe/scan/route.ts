import { NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import { nachkaufScanBodySchema } from '@/lib/api/schemas/nachkauf'
import { jsonMitOwner } from '@/lib/request-owner'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'
import type { NachkaufScanAnfrage } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, nachkaufScanBodySchema, {
    fallback: { erzwingen: false, nurFehlende: false, offset: 0, abschliessen: false },
  })
  if (!parsed.ok) return parsed.response

  const anfrage: NachkaufScanAnfrage = {
    ticker: parsed.data.ticker ?? null,
    erzwingen: parsed.data.erzwingen,
    nurFehlende: parsed.data.nurFehlende,
    offset: parsed.data.offset,
    maxProAufruf: 1,
    zeitBudgetMs: 110_000,
    leicht: !parsed.data.abschliessen,
    abschliessen: parsed.data.abschliessen,
  }

  try {
    return await jsonMitOwner(req, async () => {
      const paket = await laufeScan(anfrage)
      return NextResponse.json(paket)
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/nachkaeufe/scan]', msg)
    return NextResponse.json(
      {
        ok: false,
        fehler: `Scan fehlgeschlagen: ${msg.slice(0, 300)}`,
        ergebnisse: [],
        monatsEmpfehlung: null,
        gescannt_am: new Date().toISOString(),
        gesamtAnzahl: 0,
        gescannt: 0,
        ausstehend: 0,
      },
      { status: 502 },
    )
  }
}

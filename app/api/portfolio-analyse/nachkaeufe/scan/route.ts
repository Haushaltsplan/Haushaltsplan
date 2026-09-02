import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'
import type { NachkaufScanAnfrage } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const row = (body ?? {}) as Record<string, unknown>
  const anfrage: NachkaufScanAnfrage = {
    ticker: row.ticker != null ? String(row.ticker).trim() || null : null,
    erzwingen: row.erzwingen === true,
    nurFehlende: row.nurFehlende === true,
    offset: typeof row.offset === 'number' ? row.offset : Number(row.offset) || 0,
    maxProAufruf: 1,
    zeitBudgetMs: 110_000,
    leicht: row.abschliessen !== true,
    abschliessen: row.abschliessen === true,
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

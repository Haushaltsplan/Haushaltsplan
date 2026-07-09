import { NextResponse } from 'next/server'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'
import type { NachkaufScanAnfrage } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    offset: typeof row.offset === 'number' ? row.offset : Number(row.offset) || 0,
    maxProAufruf:
      typeof row.maxProAufruf === 'number'
        ? row.maxProAufruf
        : Number(row.maxProAufruf) > 0
          ? Number(row.maxProAufruf)
          : 2,
    zeitBudgetMs: 55_000,
  }

  try {
    const paket = await laufeScan(anfrage)
    return NextResponse.json(paket)
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
        gesamtAnzahl: 32,
        gescannt: 0,
        ausstehend: 32,
      },
      { status: 502 },
    )
  }
}

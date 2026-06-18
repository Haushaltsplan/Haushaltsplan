import { NextResponse } from 'next/server'
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
  }

  try {
    const paket = await laufeScan(anfrage)
    return NextResponse.json(paket)
  } catch (e) {
    console.error('[api/nachkaeufe/scan]', e)
    return NextResponse.json(
      { ok: false, fehler: 'Scan fehlgeschlagen.', ergebnisse: [], monatsEmpfehlung: null, gescannt_am: new Date().toISOString() },
      { status: 502 },
    )
  }
}

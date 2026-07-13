import { NextResponse } from 'next/server'
import { ladeFundamentaldaten } from '@/lib/portfolio-analyse/fundamentaldaten-server'
import { baueMantraAudit } from '@/lib/portfolio-analyse/fundamentaldaten-mantra'
import type { FundamentaldatenAnfrage, FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = body as Record<string, unknown>
  const anfrage: FundamentaldatenAnfrage = {
    isin: row.isin != null ? String(row.isin).trim() || null : null,
    name: row.name != null ? String(row.name) : undefined,
    symbolYahoo: row.symbolYahoo != null ? String(row.symbolYahoo).trim() || null : null,
    symbolCandidates: Array.isArray(row.symbolCandidates)
      ? row.symbolCandidates.map((s) => String(s).trim()).filter(Boolean)
      : undefined,
    tickerOverride: row.tickerOverride != null ? String(row.tickerOverride).trim() || null : null,
    frequenz: row.frequenz === 'quartal' ? 'quartal' : 'jahr',
  }

  try {
    const daten = await ladeFundamentaldaten(anfrage)
    return NextResponse.json(daten)
  } catch (e) {
    console.error('fundamentaldaten', e)
    const msg = e instanceof Error ? e.message : 'Abruf der Fundamentaldaten fehlgeschlagen.'
    const fehlerPaket: FundamentaldatenPaket = {
      ok: false,
      ticker: '',
      slug: '',
      firmenname: anfrage.name ?? 'Unbekannt',
      branche: null,
      sektor: null,
      website: null,
      beschreibung: null,
      waehrung: 'USD',
      perioden: [],
      zeilen: [],
      keyMetrics: [],
      mantra: baueMantraAudit(null, null, null, { perioden: [], zeilen: [] }, { perioden: [], zeilen: [] }),
      mantraMeta: null,
      news: [],
      symbolYahoo: anfrage.symbolYahoo ?? null,
      geladenAm: new Date().toISOString(),
      quelle: 'yahoo',
      fehler: msg,
    }
    return NextResponse.json({ ...fehlerPaket, message: msg }, { status: 200 })
  }
}

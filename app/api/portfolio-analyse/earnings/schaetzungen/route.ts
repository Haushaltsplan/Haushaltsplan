import { NextResponse } from 'next/server'
import {
  ladeEarningsSchaetzungen,
  type EarningsSchaetzungenAnfrage,
} from '@/lib/portfolio-analyse/earnings-schaetzungen'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const row = body as Record<string, unknown>
  const anfrage: EarningsSchaetzungenAnfrage = {
    isin: row.isin != null ? String(row.isin).trim() || null : null,
    name: row.name != null ? String(row.name) : undefined,
    symbolYahoo: row.symbolYahoo != null ? String(row.symbolYahoo).trim() || null : null,
    symbolCandidates: Array.isArray(row.symbolCandidates)
      ? row.symbolCandidates.map((s) => String(s).trim()).filter(Boolean)
      : undefined,
    terminDatumIso:
      row.terminDatumIso != null ? String(row.terminDatumIso).slice(0, 10) : undefined,
    berichtszeit:
      row.berichtszeit === 'vor_boersenoeffnung' || row.berichtszeit === 'nach_handelsschluss'
        ? row.berichtszeit
        : undefined,
  }

  try {
    const schaetzungen = await ladeEarningsSchaetzungen(anfrage)
    return NextResponse.json({
      ok: true,
      stand: new Date().toISOString(),
      schaetzungen,
    })
  } catch (e) {
    console.error('earnings schaetzungen', e)
    return NextResponse.json(
      { ok: false, message: 'Abruf der Earnings-Prognosen fehlgeschlagen.' },
      { status: 502 },
    )
  }
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alle dauerhaft gespeicherten KI-Zusammenfassungen aus Supabase (Download). */
export async function GET() {
  try {
    const { ladeAlleSecBerichtKiAusCloud, ladeAlleEarningsCallKiAusCloud } = await import(
      '@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server'
    )
    const [secMap, earningsMap] = await Promise.all([
      ladeAlleSecBerichtKiAusCloud(),
      ladeAlleEarningsCallKiAusCloud(),
    ])

    const sec = [...secMap.entries()].map(([ticker, rows]) => ({
      ticker,
      eintraege: [...rows.entries()].map(([berichtId, row]) => ({
        berichtId,
        accession: row.accession,
        zusammenfassung: row.zusammenfassung,
      })),
    }))

    const earnings = [...earningsMap.entries()].map(([ticker, rows]) => ({
      ticker,
      eintraege: [...rows.entries()].map(([quartalId, row]) => ({
        quartalId,
        transcriptUrl: row.transcriptUrl,
        zusammenfassung: row.zusammenfassung,
      })),
    }))

    return NextResponse.json({
      ok: true,
      sec,
      earnings,
      gesamt: {
        secEintraege: sec.reduce((n, b) => n + b.eintraege.length, 0),
        earningsEintraege: earnings.reduce((n, b) => n + b.eintraege.length, 0),
        tickerSec: sec.length,
        tickerEarnings: earnings.length,
      },
    })
  } catch (e) {
    console.error('ki-cache GET', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Laden fehlgeschlagen' },
      { status: 500 },
    )
  }
}

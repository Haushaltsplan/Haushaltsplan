/**
 * Vercel Cron: Automatischer monatlicher Nachkauf-Radar-Scan.
 * Cron-Schedule: 1. des Monats, 07:00 UTC (siehe vercel.json).
 *
 * Gesichert durch CRON_SECRET-Header-Validierung.
 */
import { NextResponse } from 'next/server'
import { laufeScan } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-scan-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  // Vercel setzt Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ergebnis = await laufeScan({ erzwinge: false, nurFehlende: true })
    return NextResponse.json({
      ok: true,
      gescannt: ergebnis.gescannt,
      gesamtAnzahl: ergebnis.gesamtAnzahl,
      zeitstempel: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[cron-scan] Fehler:', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

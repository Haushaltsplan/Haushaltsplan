/**
 * Vercel Cron: Automatischer monatlicher Nachkauf-Radar-Scan.
 * Cron-Schedule: 1. des Monats, 07:00 UTC (siehe vercel.json).
 *
 * Gesichert durch CRON_SECRET-Header-Validierung.
 */
import { NextResponse } from 'next/server'
import { runWithPrimaeremOwner } from '@/lib/request-owner'
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
    return await runWithPrimaeremOwner(async () => {
    let offset = 0
    let gescanntGesamt = 0
    let gesamtAnzahl = 0
    let runden = 0
    const MAX_RUNDEN = 12

    while (runden < MAX_RUNDEN) {
      const ergebnis = await laufeScan({
        erzwingen: false,
        offset,
        maxProAufruf: 3,
        zeitBudgetMs: 45_000,
      })
      gesamtAnzahl = ergebnis.gesamtAnzahl
      if (ergebnis.gescannt === 0) break
      gescanntGesamt += ergebnis.gescannt
      offset += ergebnis.gescannt
      runden++
      if ((ergebnis.verbleibend ?? 0) === 0) break
    }

    return NextResponse.json({
      ok: true,
      gescannt: gescanntGesamt,
      gesamtAnzahl,
      zeitstempel: new Date().toISOString(),
    })
    })
  } catch (e) {
    console.error('[cron-scan] Fehler:', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

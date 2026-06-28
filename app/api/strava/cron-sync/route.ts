/**
 * Vercel Cron: Wöchentlicher Strava-Sync für alle verbundenen Nutzer.
 * Schedule: Sonntag 06:00 UTC (siehe vercel.json).
 */
import { synchronisiereAlleStravaCron } from '@/lib/strava/strava-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ergebnis = await synchronisiereAlleStravaCron()
    return NextResponse.json({
      ok: true,
      ...ergebnis,
      zeitstempel: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[strava-cron-sync] Fehler:', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

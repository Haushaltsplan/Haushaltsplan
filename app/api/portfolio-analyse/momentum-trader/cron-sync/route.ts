/**
 * Vercel Cron: Täglicher Momentum-Trader Full-Sync (Watchlist-only).
 * Wochentags 07:00 + 22:00 UTC — siehe vercel.json.
 *
 * Gesichert durch CRON_SECRET-Header-Validierung.
 */
import { NextResponse } from 'next/server'
import { cronMomentumSyncAlleNutzer } from '@/lib/portfolio-analyse/momentum-trader/momentum-cron-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ergebnis = await cronMomentumSyncAlleNutzer()
    return NextResponse.json(ergebnis)
  } catch (e) {
    console.error('[momentum-cron-sync] Fehler:', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

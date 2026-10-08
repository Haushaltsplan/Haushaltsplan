/**
 * Depot∪Watchlist neu einlesen und Radar-Scans außerhalb bereinigen.
 * Aufruf nach Kauf/Verkauf/Import und (ergänzend) Watchlist-Änderungen.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner, requireOwnerUserId } from '@/lib/request-owner'
import { invalidateLivePortfolioCache } from '@/lib/portfolio-analyse/depot-gewichte-server'
import {
  bereinigeNachkaufRadarAusserhalbKandidaten,
  ladeNachkaufKandidaten,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      invalidateLivePortfolioCache(requireOwnerUserId())
      const kandidaten = await ladeNachkaufKandidaten()
      const entfernt = await bereinigeNachkaufRadarAusserhalbKandidaten(kandidaten)
      const depot = kandidaten.filter((k) => k.quelle === 'depot').length
      const watchlist = kandidaten.filter((k) => k.quelle === 'watchlist').length
      return NextResponse.json({
        ok: true,
        anzahl: kandidaten.length,
        depot,
        watchlist,
        entfernt,
      })
    } catch (e) {
      console.error('[universum-sync]', e)
      return NextResponse.json(
        { ok: false, message: e instanceof Error ? e.message : 'Universum-Sync fehlgeschlagen.' },
        { status: 502 },
      )
    }
  })
}

/**
 * Depot-Cache nach Kauf/Verkauf/Import neu lesen.
 * Gespeicherte Radar-Scans und Deep-Research-Memos bleiben erhalten.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner, requireOwnerUserId } from '@/lib/request-owner'
import { invalidateLivePortfolioCache } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      invalidateLivePortfolioCache(requireOwnerUserId())
      const kandidaten = await ladeNachkaufKandidaten()
      const entfernt = 0
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

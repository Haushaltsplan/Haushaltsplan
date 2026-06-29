/**
 * Earnings-Kalender nur für Watchlist-Titel (DivvyDiary, sequentiell).
 * POST /api/portfolio-analyse/momentum-trader/earnings/sync
 */
import { NextResponse } from 'next/server'
import { syncEarningsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-sync-server'
import { ladeMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ ok: false, fehler: ['Nicht angemeldet.'] }, { status: 401 })
  }

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ ok: false, fehler: ['Nicht angemeldet.'] }, { status: 401 })
  }

  try {
    const watchlist = await ladeMomentumWatchlist(sb)
    const ergebnis = await syncEarningsFuerWatchlist(sb, watchlist)
    return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 207 })
  } catch (e) {
    console.error('[api/momentum-trader/earnings/sync]', e)
    return NextResponse.json(
      { ok: false, watchlistGroesse: 0, termineGeschrieben: 0, fehler: [String(e)] },
      { status: 500 },
    )
  }
}

/** Earnings-Kalender für die Watchlist. */
import { NextResponse } from 'next/server'
import { baueMomentumEarningsKalender } from '@/lib/portfolio-analyse/momentum-trader/momentum-kalender-server'
import { reichereWatchlistMitEarningsAn } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-enrich-server'
import { ladeMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const raw = await ladeMomentumWatchlist(sb)
    const watchlist = await reichereWatchlistMitEarningsAn(raw)
    const u = new URL(req.url)
    const tage = Number(u.searchParams.get('tage') ?? 35)
    const kalender = await baueMomentumEarningsKalender(watchlist, Number.isFinite(tage) ? tage : 35)
    return NextResponse.json({ kalender })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

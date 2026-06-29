/** Pre-Event vs. Post-Earnings Trefferquote (Scan-Verlauf). */
import { NextResponse } from 'next/server'
import { berechneKatalysatorTracking } from '@/lib/portfolio-analyse/momentum-trader/momentum-katalysator-tracking-server'
import {
  ladeMomentumWatchlist,
  symboleAusWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
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
    const watchlist = await ladeMomentumWatchlist(sb)
    const symbole = symboleAusWatchlist(watchlist)
    const tracking = await berechneKatalysatorTracking(symbole)
    return NextResponse.json({ tracking })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

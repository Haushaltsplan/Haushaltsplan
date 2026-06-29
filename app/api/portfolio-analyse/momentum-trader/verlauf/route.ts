/** Score-Verlauf für Sparklines. */
import { NextResponse } from 'next/server'
import { ladeMomentumScoreVerlauf } from '@/lib/portfolio-analyse/momentum-trader/momentum-scan-verlauf-server'
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
    const map = await ladeMomentumScoreVerlauf(symbole)
    const verlauf: Record<string, ReturnType<typeof map.get>> = {}
    for (const [sym, pts] of map) verlauf[sym] = pts
    return NextResponse.json({ verlauf })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

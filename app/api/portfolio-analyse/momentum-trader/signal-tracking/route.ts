/** Top-Signal Forward-Tracking — Vorhersage vs. Kursverlauf + Journal-Vergleich. */
import { NextResponse } from 'next/server'
import { berechneTopSignalTracking } from '@/lib/portfolio-analyse/momentum-trader/momentum-top-signal-tracking-server'
import { ladeMomentumTradesAlle } from '@/lib/portfolio-analyse/momentum-trader/momentum-trades-server'
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
    const trades = await ladeMomentumTradesAlle(sb)
    const signalTracking = await berechneTopSignalTracking(symbole, trades)
    return NextResponse.json({ signalTracking })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

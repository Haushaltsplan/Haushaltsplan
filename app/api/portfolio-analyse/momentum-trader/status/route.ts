/** Datenfundament-Status (scoped auf eigene Watchlist). */
import { NextResponse } from 'next/server'
import { ladeMomentumDatenStatus } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  ladeMomentumWatchlist,
  symboleAusWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  try {
    const watchlist = await ladeMomentumWatchlist(sb)
    const symbole = [...new Set([...MOMENTUM_REGIME_SYMBOLS, ...symboleAusWatchlist(watchlist)])]
    const status = await ladeMomentumDatenStatus({
      watchlistAnzahl: watchlist.length,
      watchlistSymbole: symbole,
    })
    return NextResponse.json(status)
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

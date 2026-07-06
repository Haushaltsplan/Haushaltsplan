/** Datenfundament-Status (scoped auf eigene Watchlist). */
import { NextResponse } from 'next/server'
import { berechneMomentumErinnerungen } from '@/lib/portfolio-analyse/momentum-trader/momentum-erinnerungen-server'
import { generiereMomentumHandlungsempfehlung } from '@/lib/portfolio-analyse/momentum-trader/momentum-handlungsempfehlung-server'
import {
  ladeMomentumDatenStatus,
  ladeNeuestenMomentumScan,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { reichereWatchlistMitEarningsAn } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-enrich-server'
import {
  ladeMomentumWatchlist,
  symboleAusWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { ladeMomentumTrades } from '@/lib/portfolio-analyse/momentum-trader/momentum-trades-server'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    const [{ count: tradesAnzahl }, angereichert, trades, scanNeu] = await Promise.all([
      sb.from('momentum_trades').select('*', { count: 'exact', head: true }),
      reichereWatchlistMitEarningsAn(watchlist),
      ladeMomentumTrades(sb),
      ladeNeuestenMomentumScan(),
    ])
    const status = await ladeMomentumDatenStatus({
      watchlistAnzahl: watchlist.length,
      watchlistSymbole: symbole,
      tradesAnzahl: tradesAnzahl ?? 0,
    })
    const scan =
      scanNeu != null
        ? {
            scanDate: scanNeu.scanDate,
            regime: null,
            ergebnisse: scanNeu.ergebnisse.filter((e) =>
              symboleAusWatchlist(watchlist).includes(e.symbol),
            ),
          }
        : null
    const erinnerungen = berechneMomentumErinnerungen({
      watchlist: angereichert,
      trades,
      scan,
      barsNeuesterTag: status.barsNeuesterTag,
    })
    const handlungsempfehlung = generiereMomentumHandlungsempfehlung({
      watchlist: angereichert,
      status,
      scan,
      trades,
    })
    return NextResponse.json({ ...status, erinnerungen, handlungsempfehlung })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

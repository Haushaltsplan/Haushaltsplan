/** Tages-Briefing als Markdown. */
import { NextResponse } from 'next/server'
import { berechneKatalysatorTracking } from '@/lib/portfolio-analyse/momentum-trader/momentum-katalysator-tracking-server'
import { berechneMomentumErinnerungen } from '@/lib/portfolio-analyse/momentum-trader/momentum-erinnerungen-server'
import { berechneMomentumPerformance } from '@/lib/portfolio-analyse/momentum-trader/momentum-performance-server'
import { generiereMomentumBriefing } from '@/lib/portfolio-analyse/momentum-trader/momentum-briefing-server'
import { baueMomentumEarningsKalender } from '@/lib/portfolio-analyse/momentum-trader/momentum-kalender-server'
import {
  ladeMomentumDatenStatus,
  ladeNeuestenMomentumScan,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { berechneRegimeGates } from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-server'
import { ladePlaybookStats } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-stats-server'
import { reichereWatchlistMitEarningsAn } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-enrich-server'
import {
  ladeMomentumWatchlist,
  symboleAusWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import {
  ladeMomentumTradesAlle,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trades-server'
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
    const symbole = symboleAusWatchlist(watchlist)
    const [scanNeu, trades] = await Promise.all([
      ladeNeuestenMomentumScan(),
      ladeMomentumTradesAlle(sb),
    ])
    const status = await ladeMomentumDatenStatus({
      watchlistAnzahl: watchlist.length,
      watchlistSymbole: symbole,
      tradesAnzahl: trades.length,
    })

    const scanDate = scanNeu?.scanDate ?? new Date().toISOString().slice(0, 10)
    const ergebnisse =
      scanNeu?.ergebnisse.filter((e) => symbole.includes(e.symbol)) ?? []
    const regimeGates = status.regime ? berechneRegimeGates(status.regime) : null
    const kalender = await baueMomentumEarningsKalender(watchlist)
    const erinnerungen = berechneMomentumErinnerungen({
      watchlist,
      trades,
      scan: scanNeu
        ? { scanDate, regime: regimeGates, ergebnisse }
        : null,
      barsNeuesterTag: status.barsNeuesterTag,
    })
    const performance = trades.length > 0 ? berechneMomentumPerformance(trades) : null
    const tracking = symbole.length > 0 ? await berechneKatalysatorTracking(symbole) : null
    const playbookStats = await ladePlaybookStats()

    const markdown = generiereMomentumBriefing({
      scanDate,
      regime: regimeGates,
      ergebnisse,
      erinnerungen,
      watchlist,
      kalender,
      trades,
      performance,
      tracking,
      playbookStats,
    })

    return NextResponse.json({ scanDate, markdown })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

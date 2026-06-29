import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBarsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-bars-sync-server'
import { backfillEarningsEventsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { syncEarningsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-sync-server'
import { syncMomentumMarketRegime } from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-server'
import { scanMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-scan-server'
import type {
  MomentumFullSyncErgebnis,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/**
 * Komplette Pipeline: Earnings → Kurse → Event-Backfill → Regime → Scan.
 * Sequentiell, watchlist-only.
 */
export async function fuehreVollenMomentumSyncAus(
  sb: SupabaseClient,
  watchlist: MomentumWatchlistEintrag[],
): Promise<MomentumFullSyncErgebnis> {
  if (watchlist.length === 0) {
    return {
      ok: false,
      schritte: [],
      fehler: ['Watchlist leer.'],
      scan: null,
    }
  }

  const schritte: string[] = []
  const fehler: string[] = []

  const earnings = await syncEarningsFuerWatchlist(sb, watchlist)
  schritte.push(
    'Earnings: ' + earnings.termineGeschrieben + ' Termine für ' + earnings.watchlistGroesse + ' Titel',
  )
  if (earnings.fehler.length) fehler.push(...earnings.fehler)

  const bars = await syncBarsFuerWatchlist(watchlist, 252)
  schritte.push('Kurse: ' + bars.kerzenGeschrieben + ' Kerzen, ' + bars.symbole + ' Symbole')
  if (bars.fehler) fehler.push(bars.fehler)
  if (!bars.ok) fehler.push('Kurs-Sync unvollständig')

  const events = await backfillEarningsEventsFuerWatchlist(watchlist)
  schritte.push('Earnings-Historie: ' + events.geschrieben + ' Events')
  if (events.fehler.length) fehler.push(...events.fehler)

  const regimeGates = await syncMomentumMarketRegime()
  if (regimeGates) {
    schritte.push(
      'Regime: SPY ' +
        (regimeGates.regime.spyAbove20Ma ? 'über' : 'unter') +
        ' MA20, VIX ' +
        (regimeGates.regime.vixClose?.toFixed(1) ?? '—'),
    )
  } else {
    fehler.push('Regime konnte nicht berechnet werden')
  }

  let scan = null
  if (regimeGates) {
    scan = await scanMomentumWatchlist(watchlist, regimeGates)
    schritte.push('Scan: ' + scan.ergebnisse.length + ' Setup(s)')
  }

  return {
    ok: fehler.length === 0,
    schritte,
    fehler,
    scan,
  }
}

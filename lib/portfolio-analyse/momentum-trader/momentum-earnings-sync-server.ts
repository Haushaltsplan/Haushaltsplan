import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { ladeAlleEarningsTermineFuerIsin } from '@/lib/portfolio-analyse/earnings-termine-alle'
import {
  setzeMomentumWatchlistEarningsSync,
  symboleAusWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { speichereMomentumEarningsKalender } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import type {
  MomentumEarningsKalenderEintrag,
  MomentumEarningsSyncErgebnis,
  MomentumEarningsZeit,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/** Pause zwischen DivvyDiary-Scrapes — schont Warteschlange und Rate-Limits. */
const PAUSE_MS = 2_500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function berichtszeitZuMomentumZeit(zeit: Berichtszeit | null): MomentumEarningsZeit {
  if (zeit === 'vor_boersenoeffnung') return 'bmo'
  if (zeit === 'nach_handelsschluss') return 'amc'
  return 'unknown'
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

/**
 * Earnings-Kalender nur für Watchlist-Titel (DivvyDiary, sequentiell).
 * Kein Marktweit-Scan — ein Titel nach dem anderen.
 */
export async function syncEarningsFuerWatchlist(
  sb: SupabaseClient,
  eintraege: MomentumWatchlistEintrag[],
): Promise<MomentumEarningsSyncErgebnis> {
  const fehler: string[] = []
  let termineGeschrieben = 0

  if (eintraege.length === 0) {
    return {
      ok: false,
      watchlistGroesse: 0,
      termineGeschrieben: 0,
      fehler: ['Watchlist ist leer — zuerst Titel hinzufügen.'],
    }
  }

  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i]
    const symbol = primaeresSymbol(e)
    if (!symbol) {
      fehler.push(e.isin + ': kein Yahoo-Symbol hinterlegt.')
      continue
    }

    if (i > 0) await sleep(PAUSE_MS)

    try {
      const termine = await ladeAlleEarningsTermineFuerIsin(e.isin, e.name)
      const kalender: MomentumEarningsKalenderEintrag[] = termine.map((t) => ({
        symbol,
        earningsDate: t.terminDatumIso,
        timeBmoAmc: berichtszeitZuMomentumZeit(t.berichtszeit),
        epsEstimate: null,
        revenueEstimate: null,
        quarter: null,
        year: null,
      }))

      if (kalender.length > 0) {
        termineGeschrieben += await speichereMomentumEarningsKalender(kalender)
      }

      await setzeMomentumWatchlistEarningsSync(sb, e.isin)
    } catch (err) {
      fehler.push(e.isin + ': ' + String(err))
    }
  }

  return {
    ok: fehler.length === 0,
    watchlistGroesse: eintraege.length,
    termineGeschrieben,
    fehler,
  }
}

/** Symbole für Bars-Sync: Regime-Indizes + Watchlist. */
export function syncSymboleFuerWatchlist(
  eintraege: MomentumWatchlistEintrag[],
  regimeSymbole: readonly string[],
): string[] {
  return [...new Set([...regimeSymbole, ...symboleAusWatchlist(eintraege)])]
}

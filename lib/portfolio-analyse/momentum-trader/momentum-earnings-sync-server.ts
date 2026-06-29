import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  setzeMomentumWatchlistEarningsSync,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { speichereMomentumEarningsKalender } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  ladeMomentumEarningsTermineFuerTitel,
  MOMENTUM_EARNINGS_HORIZONT_TAGE,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-termine-server'
import type {
  MomentumEarningsKalenderEintrag,
  MomentumEarningsSyncErgebnis,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { addDaysIso, heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'

/** Pause zwischen externen Abrufen — schont Scraper-Warteschlange. */
const PAUSE_MS = 2_500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

/**
 * Earnings-Kalender für die Watchlist — DivvyDiary + Finnhub + Yahoo.
 * Alle Termine im Horizont (nicht nur das nächste Quartal).
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

  const heute = heuteIsoUtc()
  const bis = addDaysIso(heute, MOMENTUM_EARNINGS_HORIZONT_TAGE)

  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i]
    const symbol = primaeresSymbol(e)
    if (!symbol) {
      fehler.push(e.isin + ': kein Yahoo-Symbol hinterlegt.')
      continue
    }

    if (i > 0) await sleep(PAUSE_MS)

    try {
      const termine = await ladeMomentumEarningsTermineFuerTitel(e, heute, bis)
      const kalender: MomentumEarningsKalenderEintrag[] = termine.map((t) => ({
        symbol,
        earningsDate: t.terminDatumIso,
        timeBmoAmc: t.timeBmoAmc,
        epsEstimate: null,
        revenueEstimate: null,
        quarter: null,
        year: null,
      }))

      if (kalender.length > 0) {
        termineGeschrieben += await speichereMomentumEarningsKalender(kalender)
      } else {
        fehler.push(symbol + ': keine Earnings-Termine gefunden (DivvyDiary/Yahoo/Finnhub).')
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

import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { speichereMomentumBars } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { syncMomentumMarketRegime } from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-server'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import { syncSymboleFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-sync-server'
import type {
  MomentumBarsSyncErgebnis,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { ladeYahooOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/yahoo-ohlcv-server'

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

export async function syncBarsFuerWatchlist(
  watchlist: MomentumWatchlistEintrag[],
  tage = 252,
): Promise<MomentumBarsSyncErgebnis> {
  const bisDatum = heuteIsoUtc()
  const vonDatum = addDaysIso(bisDatum, -tage)
  const symbole = syncSymboleFuerWatchlist(watchlist, MOMENTUM_REGIME_SYMBOLS)

  if (symboleAusWatchlist(watchlist).length === 0) {
    return {
      ok: false,
      symbole: 0,
      kerzenGeschrieben: 0,
      vonDatum,
      bisDatum,
      fehler: 'Watchlist leer.',
    }
  }

  const batch = await ladeYahooOhlcvBatch(symbole, vonDatum, bisDatum)
  const alleBars = [...batch.values()].flat()
  const geschrieben = await speichereMomentumBars(alleBars)
  await syncMomentumMarketRegime()

  return {
    ok: true,
    symbole: batch.size,
    kerzenGeschrieben: geschrieben,
    vonDatum,
    bisDatum,
    fehler:
      batch.size < symbole.length
        ? 'Nur ' + batch.size + ' von ' + symbole.length + ' Symbolen mit Daten.'
        : null,
  }
}

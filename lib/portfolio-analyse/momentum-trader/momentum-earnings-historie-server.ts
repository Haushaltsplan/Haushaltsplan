import 'server-only'

import { isoVorJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeMarketbeatBeatMissHistorie } from '@/lib/portfolio-analyse/marketbeat-beat-miss-historie-server'
import {
  ladeMomentumEarningsTermineFuerTitel,
  type MomentumEarningsTerminAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-termine-server'
import {
  momentumEarningsTicker,
  primaeresEarningsSymbol,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import type { MomentumWatchlistEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/**
 * Historische Earnings-Termine — DivvyDiary/Yahoo/MarketBeat + MarketBeat earnings-history
 * (liefert oft 8–12 vergangene Quartale mit exaktem Berichtsdatum).
 */
export async function ladeHistorischeEarningsTermine(
  eintrag: MomentumWatchlistEintrag,
  vonIso: string,
  bisIso: string,
): Promise<MomentumEarningsTerminAngereichert[]> {
  const byDate = new Map<string, MomentumEarningsTerminAngereichert>()

  const basis = await ladeMomentumEarningsTermineFuerTitel(eintrag, vonIso, bisIso)
  for (const t of basis) {
    if (t.terminDatumIso >= vonIso && t.terminDatumIso <= bisIso) {
      byDate.set(t.terminDatumIso, t)
    }
  }

  const earningsSym = primaeresEarningsSymbol(eintrag)
  if (!earningsSym) return [...byDate.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))

  try {
    const mb = await ladeMarketbeatBeatMissHistorie({
      ticker: earningsSym,
      symbolYahoo: momentumEarningsTicker(earningsSym),
      limit: 24,
    })
    for (const row of mb) {
      const d = row.period
      if (!d || d < vonIso || d > bisIso || byDate.has(d)) continue
      byDate.set(d, {
        terminDatumIso: d,
        berichtszeit: null,
        timeBmoAmc: 'unknown',
        quelle: 'marketbeat',
        bestaetigt: true,
      })
    }
  } catch {
    /* optional */
  }

  return [...byDate.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

export function standardHistorieVonIso(): string {
  return isoVorJahren(3)
}

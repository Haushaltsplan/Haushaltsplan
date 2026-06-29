import 'server-only'

import { ladeFinnhubEpsIst } from '@/lib/portfolio-analyse/finnhub-earnings-ist-server'
import { leiteGuidanceFlagAb } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import type { MomentumEarningsEvent } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/** Finnhub EPS-Surprise in Event übernehmen (ein API-Call pro Event-Datum). */
export async function reichereEventMitFinnhub(
  event: MomentumEarningsEvent,
): Promise<MomentumEarningsEvent> {
  const fh = await ladeFinnhubEpsIst(event.symbol, event.earningsDate)
  if (!fh) return event

  const surpriseEpsPct = fh.surprisePercent
  return {
    ...event,
    epsEstimate: fh.schaetzung,
    epsActual: fh.ist,
    surpriseEpsPct,
    guidanceFlag: leiteGuidanceFlagAb(surpriseEpsPct),
  }
}

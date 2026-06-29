import 'server-only'

import { beatMissProzent } from '@/lib/portfolio-analyse/earnings-beat-miss'
import { quartalLabelAusTermin } from '@/lib/portfolio-analyse/earnings-quartal-termin'
import { ladeFinnhubEpsIst } from '@/lib/portfolio-analyse/finnhub-earnings-ist-server'
import { leiteGuidanceFlagAb } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import type { MomentumEarningsEvent } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeYahooEarningsHistoryZeile } from '@/lib/portfolio-analyse/yahoo-earnings-history-server'

/** Finnhub EPS-Surprise, Fallback Yahoo earningsHistory. */
export async function reichereEventMitEpsSurprise(
  event: MomentumEarningsEvent,
): Promise<MomentumEarningsEvent> {
  const fh = await ladeFinnhubEpsIst(event.symbol, event.earningsDate)
  if (fh) {
    const surpriseEpsPct = fh.surprisePercent
    return {
      ...event,
      epsEstimate: fh.schaetzung,
      epsActual: fh.ist,
      surpriseEpsPct,
      guidanceFlag: leiteGuidanceFlagAb(surpriseEpsPct),
    }
  }

  const label = quartalLabelAusTermin(event.earningsDate)
  const yh = await ladeYahooEarningsHistoryZeile(event.symbol, [label])
  const epsIst = yh?.ist?.eps
  const epsSchaetzung = yh?.schaetzung?.eps
  if (epsIst == null) return event

  const surpriseEpsPct = beatMissProzent(epsIst, epsSchaetzung ?? null)
  return {
    ...event,
    epsEstimate: epsSchaetzung ?? null,
    epsActual: epsIst,
    surpriseEpsPct,
    guidanceFlag: leiteGuidanceFlagAb(surpriseEpsPct),
  }
}

/** @deprecated Alias — nutzt Finnhub + Yahoo-Fallback. */
export const reichereEventMitFinnhub = reichereEventMitEpsSurprise

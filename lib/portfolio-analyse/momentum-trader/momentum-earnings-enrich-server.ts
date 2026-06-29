import 'server-only'

import { beatMissProzent } from '@/lib/portfolio-analyse/earnings-beat-miss'
import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { quartalLabelAusTermin } from '@/lib/portfolio-analyse/earnings-quartal-termin'
import { ladeMarketbeatBeatMissHistorie } from '@/lib/portfolio-analyse/marketbeat-beat-miss-historie-server'
import { leiteGuidanceFlagAb } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import { momentumEarningsTicker } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import type { MomentumEarningsEvent } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeYahooEarningsHistoryZeile } from '@/lib/portfolio-analyse/yahoo-earnings-history-server'

function marketbeatZeileFuerTermin(
  rows: Awaited<ReturnType<typeof ladeMarketbeatBeatMissHistorie>>,
  earningsDate: string,
  quartalLabel: string,
) {
  const exakt = rows.find((r) => r.period === earningsDate)
  if (exakt) return exakt
  const nah = rows.find((r) => r.period && Math.abs(tageZwischenIso(r.period, earningsDate)) <= 14)
  if (nah) return nah
  return rows.find((r) => r.quartalLabel === quartalLabel) ?? null
}

/** EPS-Surprise: Marketbeat (primär) → Yahoo earningsHistory (Fallback). */
export async function reichereEventMitEpsSurprise(
  event: MomentumEarningsEvent,
  symbolYahoo?: string | null,
): Promise<MomentumEarningsEvent> {
  const label = quartalLabelAusTermin(event.earningsDate)
  const scrapeTicker = momentumEarningsTicker(symbolYahoo?.trim() || event.symbol)

  try {
    const mb = await ladeMarketbeatBeatMissHistorie({
      ticker: scrapeTicker,
      symbolYahoo: scrapeTicker,
      limit: 12,
    })
    const row = marketbeatZeileFuerTermin(mb, event.earningsDate, label)
    if (row?.epsIst != null) {
      const surpriseEpsPct = beatMissProzent(row.epsIst, row.epsSchaetzung)
      return {
        ...event,
        epsEstimate: row.epsSchaetzung,
        epsActual: row.epsIst,
        revenueEstimate: row.umsatzSchaetzung,
        revenueActual: row.umsatzIst,
        surpriseEpsPct,
        guidanceFlag: leiteGuidanceFlagAb(surpriseEpsPct),
      }
    }
  } catch {
    /* Marketbeat optional */
  }

  const yh = await ladeYahooEarningsHistoryZeile(scrapeTicker, [label])
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

/** @deprecated Alias */
export const reichereEventMitFinnhub = reichereEventMitEpsSurprise

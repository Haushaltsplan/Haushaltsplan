import 'server-only'

import { beatMissProzent } from '@/lib/portfolio-analyse/earnings-beat-miss'
import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { quartalLabelAusTermin } from '@/lib/portfolio-analyse/earnings-quartal-termin'
import {
  ladeMarketbeatBeatMissHistorie,
  type MarketbeatBeatMissZeile,
} from '@/lib/portfolio-analyse/marketbeat-beat-miss-historie-server'
import { leiteGuidanceFlagAb } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import { momentumEarningsTicker } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import type { MomentumEarningsEvent } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeYahooEarningsHistoryZeile } from '@/lib/portfolio-analyse/yahoo-earnings-history-server'

const MARKETBEAT_LIMIT = 24

function marketbeatZeileFuerTermin(
  rows: MarketbeatBeatMissZeile[],
  earningsDate: string,
  quartalLabel: string,
) {
  const exakt = rows.find((r) => r.period === earningsDate)
  if (exakt) return exakt
  const nah = rows.find((r) => r.period && Math.abs(tageZwischenIso(r.period, earningsDate)) <= 14)
  if (nah) return nah
  return rows.find((r) => r.quartalLabel === quartalLabel) ?? null
}

function angereichertAusMarketbeat(
  event: MomentumEarningsEvent,
  row: MarketbeatBeatMissZeile,
): MomentumEarningsEvent {
  const surpriseEpsPct = beatMissProzent(row.epsIst, row.epsSchaetzung)
  const surpriseRevPct = beatMissProzent(row.umsatzIst, row.umsatzSchaetzung)
  return {
    ...event,
    epsEstimate: row.epsSchaetzung,
    epsActual: row.epsIst,
    revenueEstimate: row.umsatzSchaetzung,
    revenueActual: row.umsatzIst,
    surpriseEpsPct,
    surpriseRevPct,
    guidanceFlag: leiteGuidanceFlagAb(surpriseEpsPct, surpriseRevPct),
  }
}

function angereichertAusYahoo(
  event: MomentumEarningsEvent,
  epsIst: number,
  epsSchaetzung: number | null,
): MomentumEarningsEvent {
  const surpriseEpsPct = beatMissProzent(epsIst, epsSchaetzung ?? null)
  return {
    ...event,
    epsEstimate: epsSchaetzung ?? null,
    epsActual: epsIst,
    surpriseEpsPct,
    guidanceFlag: leiteGuidanceFlagAb(surpriseEpsPct),
  }
}

/** MarketBeat-Zeilen einmal laden (24 Quartale) — für Batch-Backfill. */
export async function ladeMarketbeatHistorieFuerTicker(
  symbolYahoo: string,
): Promise<MarketbeatBeatMissZeile[]> {
  const scrapeTicker = momentumEarningsTicker(symbolYahoo.trim())
  try {
    return await ladeMarketbeatBeatMissHistorie({
      ticker: scrapeTicker,
      symbolYahoo: scrapeTicker,
      limit: MARKETBEAT_LIMIT,
    })
  } catch {
    return []
  }
}

function reichereEventMitCache(
  event: MomentumEarningsEvent,
  mbRows: MarketbeatBeatMissZeile[],
  scrapeTicker: string,
): MomentumEarningsEvent {
  const label = quartalLabelAusTermin(event.earningsDate)
  const row = marketbeatZeileFuerTermin(mbRows, event.earningsDate, label)
  if (row?.epsIst != null) return angereichertAusMarketbeat(event, row)
  return event
}

/** EPS + Umsatz-Surprise: MarketBeat (24Q) → Yahoo earningsHistory. */
export async function reichereEventMitEpsSurprise(
  event: MomentumEarningsEvent,
  symbolYahoo?: string | null,
  mbCache?: MarketbeatBeatMissZeile[],
): Promise<MomentumEarningsEvent> {
  const label = quartalLabelAusTermin(event.earningsDate)
  const scrapeTicker = momentumEarningsTicker(symbolYahoo?.trim() || event.symbol)

  let mbRows = mbCache
  if (!mbRows) {
    mbRows = await ladeMarketbeatHistorieFuerTicker(scrapeTicker)
  }

  const row = marketbeatZeileFuerTermin(mbRows, event.earningsDate, label)
  if (row?.epsIst != null) return angereichertAusMarketbeat(event, row)

  const yh = await ladeYahooEarningsHistoryZeile(scrapeTicker, [label])
  const epsIst = yh?.ist?.eps
  const epsSchaetzung = yh?.schaetzung?.eps
  if (epsIst == null) return event

  return angereichertAusYahoo(event, epsIst, epsSchaetzung ?? null)
}

/** Batch-Enrichment: eine MarketBeat-Anfrage pro Ticker. */
export async function reichereEventsMitEpsSurprise(
  events: MomentumEarningsEvent[],
  symbolYahoo: string,
): Promise<MomentumEarningsEvent[]> {
  if (events.length === 0) return []
  const scrapeTicker = momentumEarningsTicker(symbolYahoo.trim())
  const mbRows = await ladeMarketbeatHistorieFuerTicker(scrapeTicker)

  const out: MomentumEarningsEvent[] = []
  for (const ev of events) {
    let enriched = reichereEventMitCache(ev, mbRows, scrapeTicker)
    if (enriched.surpriseEpsPct == null) {
      enriched = await reichereEventMitEpsSurprise(enriched, scrapeTicker, mbRows)
    }
    out.push(enriched)
  }
  return out
}

/** @deprecated Alias */
export const reichereEventMitFinnhub = reichereEventMitEpsSurprise

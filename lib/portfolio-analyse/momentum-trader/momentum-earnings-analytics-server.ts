import 'server-only'

import { findeEarningsReaktionsBar } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-bar'
import { gapVolatilitaetSchaetzung } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { berechneAtr } from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type {
  MomentumBarDaily,
  MomentumEarningsEvent,
  MomentumEarningsZeit,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumEarningsHistorieStatistik = {
  eventsMitGap: number
  medianGapPct: number | null
  gapUpRatePct: number | null
  gapDownRatePct: number | null
  beatRatePct: number | null
  avgSurprisePct: number | null
  /** Ø Kursänderung 5 Handelstage vor Earnings (historisch). */
  preDrift5dPct: number | null
  /** Erwartete Größenordnung der Reaktion (%). */
  erwarteteBewegungPct: number | null
  atrImpliedMovePct: number | null
}

function findeBarIndex(bars: MomentumBarDaily[], datum: string): number {
  return bars.findIndex((b) => b.handelstag === datum)
}

function preDriftVorEarnings(
  bars: MomentumBarDaily[],
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  tage = 5,
): number | null {
  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion) return null
  const endIdx = reaktion.barIdx
  const startIdx = endIdx - tage
  if (startIdx < 0) return null
  const start = bars[startIdx].close
  const end = bars[endIdx - 1]?.close ?? reaktion.prevClose
  if (start <= 0) return null
  return Math.round(((end - start) / start) * 1000) / 10
}

/** Historische Earnings-Statistik für Pre-Event / Pre-Run. */
export function berechneEarningsHistorieStatistik(
  events: MomentumEarningsEvent[],
  bars: MomentumBarDaily[],
): MomentumEarningsHistorieStatistik {
  const gapStat = gapVolatilitaetSchaetzung(events)
  const mitGap = events.filter((e) => e.gapPct != null && Number.isFinite(e.gapPct))
  const ups = mitGap.filter((e) => (e.gapPct ?? 0) > 0).length
  const downs = mitGap.filter((e) => (e.gapPct ?? 0) < 0).length

  const drifts: number[] = []
  for (const ev of events) {
    const d = preDriftVorEarnings(bars, ev.earningsDate, ev.timeBmoAmc)
    if (d != null) drifts.push(d)
  }
  const preDrift5dPct =
    drifts.length > 0
      ? Math.round((drifts.reduce((a, b) => a + b, 0) / drifts.length) * 10) / 10
      : null

  const lastIdx = bars.length - 1
  const atr = lastIdx >= 14 ? berechneAtr(bars, lastIdx) : null
  const lastClose = bars[lastIdx]?.close
  const atrImpliedMovePct =
    atr != null && lastClose != null && lastClose > 0
      ? Math.round((atr / lastClose) * 1000) / 10
      : null

  const median = gapStat.medianGapPct
  const erwarteteBewegungPct =
    median != null && atrImpliedMovePct != null
      ? Math.round(Math.max(median, atrImpliedMovePct) * 10) / 10
      : median ?? atrImpliedMovePct

  return {
    eventsMitGap: gapStat.eventsMitGap,
    medianGapPct: median,
    gapUpRatePct: mitGap.length > 0 ? Math.round((ups / mitGap.length) * 100) : null,
    gapDownRatePct: mitGap.length > 0 ? Math.round((downs / mitGap.length) * 100) : null,
    beatRatePct: gapStat.beatRatePct,
    avgSurprisePct: gapStat.avgSurprisePct,
    preDrift5dPct,
    erwarteteBewegungPct,
    atrImpliedMovePct,
  }
}

import type { MomentumGuidanceFlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/** Guidance aus EPS- und optional Umsatz-Surprise (MarketBeat-Quartalsdaten). */
export function leiteGuidanceFlagAb(
  surpriseEpsPct: number | null,
  surpriseRevPct?: number | null,
): MomentumGuidanceFlag {
  const scores: number[] = []
  if (surpriseEpsPct != null && Number.isFinite(surpriseEpsPct)) scores.push(surpriseEpsPct)
  if (surpriseRevPct != null && Number.isFinite(surpriseRevPct)) scores.push(surpriseRevPct * 0.85)
  if (scores.length === 0) return 'unknown'

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  if (avg >= 8) return 'raise'
  if (avg <= -8) return 'lower'
  if (Math.abs(avg) <= 3) return 'inline'
  return avg > 0 ? 'raise' : 'lower'
}

export function guidanceLabel(flag: MomentumGuidanceFlag): string {
  if (flag === 'raise') return 'Guidance eher positiv'
  if (flag === 'lower') return 'Guidance eher negativ'
  if (flag === 'inline') return 'Guidance inline'
  return 'Guidance unbekannt'
}

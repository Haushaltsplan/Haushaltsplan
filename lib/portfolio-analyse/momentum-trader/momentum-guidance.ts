import type { MomentumGuidanceFlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/** Guidance aus EPS-Surprise ableiten (kein Call-Transkript nötig). */
export function leiteGuidanceFlagAb(surpriseEpsPct: number | null): MomentumGuidanceFlag {
  if (surpriseEpsPct == null || !Number.isFinite(surpriseEpsPct)) return 'unknown'
  if (surpriseEpsPct >= 8) return 'raise'
  if (surpriseEpsPct <= -8) return 'lower'
  if (Math.abs(surpriseEpsPct) <= 3) return 'inline'
  return surpriseEpsPct > 0 ? 'raise' : 'lower'
}

export function guidanceLabel(flag: MomentumGuidanceFlag): string {
  if (flag === 'raise') return 'Guidance eher positiv'
  if (flag === 'lower') return 'Guidance eher negativ'
  if (flag === 'inline') return 'Guidance inline'
  return 'Guidance unbekannt'
}

/** Segment-Historie aus mehreren Quellen zusammenführen (ohne server-only). */

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

export function summeUmsatzMio(h: SecSegmentHistorie | null | undefined): number {
  const letztes = h?.jahre.at(-1)
  if (!letztes) return 0
  return letztes.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
}

function abweichungPct(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0
  return (Math.abs(a - b) / Math.max(a, b)) * 100
}

/**
 * Zwei Historien vergleichen. Bei stark abweichenden Summen wird die niedrigere
 * Quelle bevorzugt (Marketscreener-Charts sind bei Non-Dec-FY oft aufgebläht).
 */
export function waehlePlausibleSegmentHistorie(
  a: SecSegmentHistorie | null | undefined,
  b: SecSegmentHistorie | null | undefined,
  opts?: { maxAbweichungPct?: number },
): SecSegmentHistorie | null {
  if (!a) return b ?? null
  if (!b) return a

  const maxAbw = opts?.maxAbweichungPct ?? 20
  const sumA = summeUmsatzMio(a)
  const sumB = summeUmsatzMio(b)

  if (sumA > 0 && sumB > 0 && abweichungPct(sumA, sumB) > maxAbw) {
    return sumA <= sumB ? a : b
  }

  return a.anzahlJahre >= b.anzahlJahre ? a : b
}

/**
 * MS vs. StockAnalysis: Wenn MS deutlich höher ist, SA bevorzugen (typisch bei Non-Dec-FY).
 */
export function besteSegmentHistorieQuellen(
  ms: SecSegmentHistorie | null | undefined,
  sa: SecSegmentHistorie | null | undefined,
): SecSegmentHistorie | null {
  if (!ms) return sa ?? null
  if (!sa) return ms

  const msSum = summeUmsatzMio(ms)
  const saSum = summeUmsatzMio(sa)
  if (msSum > 0 && saSum > 0) {
    const ratio = msSum / saSum
    if (ratio > 1.25) return sa
    if (ratio < 0.75) return ms
  }

  return ms.anzahlJahre >= sa.anzahlJahre ? ms : sa
}

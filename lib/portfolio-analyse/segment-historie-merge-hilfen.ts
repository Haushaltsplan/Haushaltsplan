/** Segment-Historie aus mehreren Quellen zusammenführen (ohne server-only). */

import type {
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

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

const HEALTHCARE_SEGMENT = /united healthcare|optum|pharmacy benefit|health insurance/i
const RAIL_SEGMENT = /railroad|freight rail/i

/**
 * Geo von MS oft aufgebläht, wenn Produkt bereits aus SA kommt (Non-Dec-FY).
 */
export function bereinigeGeoNachProdukt(
  produkt: SecSegmentHistorie | null | undefined,
  geo: SecSegmentHistorie | null | undefined,
  saGeo: SecSegmentHistorie | null | undefined,
): SecSegmentHistorie | null {
  if (!geo) return null
  const prodSum = summeUmsatzMio(produkt)
  const geoSum = summeUmsatzMio(geo)
  if (prodSum > 0 && geoSum > 0 && geoSum / prodSum > 1.3) {
    return saGeo ?? null
  }
  return geo
}

/** Cloud-/Cache-Paket auf offensichtliche Querzuordnung prüfen. */
export function segmentPaketPlausibel(
  paket: SecSegmentHistoriePaket | null | undefined,
  opts?: { ticker?: string | null; name?: string | null },
): boolean {
  if (!paket?.produkt && !paket?.geo) return false

  const ticker = opts?.ticker?.trim().toUpperCase().split('.')[0]
  const prodSegs = paket.produkt?.jahre.at(-1)?.segmente.map((s) => s.name) ?? []
  const prodSum = summeUmsatzMio(paket.produkt)
  const geoSum = summeUmsatzMio(paket.geo)

  if (ticker === 'UNP') {
    if (prodSegs.some((s) => HEALTHCARE_SEGMENT.test(s))) return false
    if (prodSum > 80_000) return false
  }
  if (ticker === 'UNH' && prodSegs.some((s) => RAIL_SEGMENT.test(s))) return false
  if ((ticker === 'MA' || ticker === 'V') && (paket.produkt?.jahre.at(-1)?.segmente.length ?? 0) < 2) {
    return false
  }

  if (prodSum > 0 && geoSum > 0 && geoSum / prodSum > 1.35) return false

  return true
}

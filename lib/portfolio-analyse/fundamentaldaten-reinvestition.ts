/**
 * Reinvestitionsquote & Incremental ROIC — Zinseszins-Motor.
 */

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

function w(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function histKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

export type ReinvestitionKennzahlen = {
  /**
   * (CapEx + M&A − D&A) / |FCF| in %.
   * Hoch = kann Gewinne produktiv reinvestieren; niedrig = Ausschütter.
   */
  reinvestitionsquotePct: number | null
  /** M&A-bereinigter ROIIC (organisch/tangible/book) aus gescrapten Statements. */
  incrementalRoicPct: number | null
  /** CapEx + M&A (Mio.), positiv = Investition. */
  bruttoReinvestMio: number | null
}

/**
 * @param mnaMio optionale M&A-Ausgaben (positiv, Mio. USD) aus Yahoo CapAlloc
 * @param daMioFallback D&A in Mio. wenn GuV-Zeile `da` fehlt
 * @param incrementalRoicPctOverride GuruFocus ROIIC (bevorzugt)
 */
export function berechneReinvestition(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  mnaMio: number | null = null,
  daMioFallback: number | null = null,
  incrementalRoicPctOverride: number | null = null,
): ReinvestitionKennzahlen {
  const keys = histKeys(perioden)
  if (keys.length < 1) {
    return {
      reinvestitionsquotePct: null,
      incrementalRoicPct: incrementalRoicPctOverride,
      bruttoReinvestMio: null,
    }
  }

  const t = keys[keys.length - 1]!

  const capex = w(zeilen, 'capex', t)
  const daZeile = w(zeilen, 'da', t)
  const da = daZeile ?? daMioFallback
  const fcf = w(zeilen, 'fcf', t)

  const capexAbs = capex != null ? Math.abs(capex) : null
  const daAbs = da != null ? Math.abs(da) : null
  const mnaAbs = mnaMio != null && mnaMio > 0 ? mnaMio : 0

  let bruttoReinvestMio: number | null = null
  if (capexAbs != null) {
    bruttoReinvestMio = Math.round((capexAbs + mnaAbs) * 10) / 10
  }

  let reinvestitionsquotePct: number | null = null
  if (capexAbs != null && fcf != null && Math.abs(fcf) >= 1) {
    const nettoReinvest = capexAbs + mnaAbs - (daAbs ?? 0)
    reinvestitionsquotePct = Math.round((nettoReinvest / Math.abs(fcf)) * 1000) / 10
  }

  return {
    reinvestitionsquotePct,
    incrementalRoicPct: incrementalRoicPctOverride,
    bruttoReinvestMio,
  }
}

/** PEG = Forward-KGV / erwartetes EPS-Wachstum (%). */
export function berechnePegRatio(
  forwardPe: number | null | undefined,
  epsWachstumPct: number | null | undefined,
  finvizPeg?: number | null,
): number | null {
  if (forwardPe != null && forwardPe > 0 && epsWachstumPct != null && epsWachstumPct > 0.5) {
    return Math.round((forwardPe / epsWachstumPct) * 100) / 100
  }
  if (finvizPeg != null && finvizPeg > 0 && finvizPeg < 50) {
    return Math.round(finvizPeg * 100) / 100
  }
  return null
}

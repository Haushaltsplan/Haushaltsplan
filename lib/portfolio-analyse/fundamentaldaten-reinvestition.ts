/**
 * Reinvestitionsquote & Incremental ROIC — Zinseszins-Motor.
 */

import { historischeJahresKeys, istQuartalsPerioden } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

function w(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function histKeys(perioden: FundamentalPeriode[]): string[] {
  // FY+Kalender-Duplikate nicht als „4 Quartale“ summieren
  if (istQuartalsPerioden(perioden)) {
    return perioden
      .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
      .map((p) => p.iso)
      .sort()
  }
  return historischeJahresKeys(perioden)
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

  const quartal = istQuartalsPerioden(perioden)

  const sumFlow = (id: string): number | null => {
    if (!quartal || keys.length < 4) return w(zeilen, id, keys[keys.length - 1]!)
    const letzte = keys.slice(-4)
    let sum = 0
    for (const k of letzte) {
      const v = w(zeilen, id, k)
      if (v == null) return null
      sum += v
    }
    return sum
  }

  const capex = sumFlow('capex')
  const daZeile = sumFlow('da')
  const da = daZeile ?? (quartal ? null : daMioFallback)
  const fcf = sumFlow('fcf')

  const capexAbs = capex != null ? Math.abs(capex) : null
  const daAbs = da != null ? Math.abs(da) : null
  // FY-M&A nicht in Quartals-TTM mischen
  const mnaAbs = !quartal && mnaMio != null && mnaMio > 0 ? mnaMio : 0

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

/**
 * PEG-Wachstum: Forward-CAGR zuerst (klassisches PEG), dann hist. CAGR, dann Yahoo.
 * Extremwerte (Turnaround von ~0 EPS, Einheiten-Mix) werden verworfen.
 */
export function waehlePegWachstumPct(opts: {
  fwdEpsCagr2?: number | null
  epsCagr3?: number | null
  yahooEpsPct?: number | null
}): number | null {
  const min = 2
  const max = 80
  for (const g of [opts.fwdEpsCagr2, opts.epsCagr3, opts.yahooEpsPct]) {
    if (g != null && Number.isFinite(g) && g >= min && g <= max) return g
  }
  return null
}

/** PEG = Forward-KGV / erwartetes EPS-Wachstum (% p.a.). */
export function berechnePegRatio(
  forwardPe: number | null | undefined,
  epsWachstumPct: number | null | undefined,
  finvizPeg?: number | null,
): number | null {
  if (
    forwardPe != null &&
    forwardPe > 0 &&
    forwardPe < 500 &&
    epsWachstumPct != null &&
    epsWachstumPct >= 2 &&
    epsWachstumPct <= 80
  ) {
    const peg = Math.round((forwardPe / epsWachstumPct) * 100) / 100
    if (peg > 0 && peg < 50) return peg
    return null
  }
  if (finvizPeg != null && finvizPeg > 0 && finvizPeg < 50) {
    return Math.round(finvizPeg * 100) / 100
  }
  return null
}

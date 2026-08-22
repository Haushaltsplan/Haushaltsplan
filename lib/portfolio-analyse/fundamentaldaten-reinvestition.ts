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
  /** ΔNOPAT / ΔInvested Capital über das letzte Jahr, in %. */
  incrementalRoicPct: number | null
  /** CapEx + M&A (Mio.), positiv = Investition. */
  bruttoReinvestMio: number | null
}

/**
 * @param mnaMio optionale M&A-Ausgaben (positiv, Mio. USD) aus Yahoo CapAlloc
 */
export function berechneReinvestition(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  mnaMio: number | null = null,
): ReinvestitionKennzahlen {
  const keys = histKeys(perioden)
  if (keys.length < 1) {
    return { reinvestitionsquotePct: null, incrementalRoicPct: null, bruttoReinvestMio: null }
  }

  const t = keys[keys.length - 1]!
  const t1 = keys.length >= 2 ? keys[keys.length - 2]! : null

  const capex = w(zeilen, 'capex', t)
  const da = w(zeilen, 'da', t)
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

  let incrementalRoicPct: number | null = null
  if (t1) {
    const ebit = w(zeilen, 'ebit', t)
    const ebit1 = w(zeilen, 'ebit', t1)
    const equity = w(zeilen, 'eigenkapital', t)
    const equity1 = w(zeilen, 'eigenkapital', t1)
    const debt = w(zeilen, 'gesamtverschuldung', t)
    const debt1 = w(zeilen, 'gesamtverschuldung', t1)
    const cash = w(zeilen, 'bargeld', t)
    const cash1 = w(zeilen, 'bargeld', t1)

    if (ebit != null && ebit1 != null && equity != null && equity1 != null) {
      const tax = 0.21
      const nopat = ebit * (1 - tax)
      const nopat1 = ebit1 * (1 - tax)
      const ic = equity + (debt ?? 0) - (cash ?? 0)
      const ic1 = equity1 + (debt1 ?? 0) - (cash1 ?? 0)
      const dNopat = nopat - nopat1
      const dIc = ic - ic1
      if (Math.abs(dIc) >= 1) {
        const incr = (dNopat / dIc) * 100
        if (Number.isFinite(incr) && Math.abs(incr) <= 400) {
          incrementalRoicPct = Math.round(incr * 10) / 10
        }
      }
    }
  }

  return { reinvestitionsquotePct, incrementalRoicPct, bruttoReinvestMio }
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

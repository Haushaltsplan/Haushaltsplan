/**
 * Incremental ROIC (ROIIC) — reine Berechnung aus Jahres-Snapshots.
 * Quelle der Rohdaten: Yahoo-Timeseries oder Nasdaq Financials (Server).
 */

import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { effektiverSteuersatz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'

export type IncrementalRoicPaket = {
  incrementalRoicPct: number | null
  incrementalRoic1yPct: number | null
  incrementalRoic5yPct: number | null
  fensterJahre: number | null
  quelle: 'yahoo' | 'nasdaq' | 'stockanalysis' | null
}

export type JahrSnap = {
  jahr: number
  nopatMio: number
  icMio: number
}

export function nopatMioAusOperating(
  operatingIncomeUsd: number | null,
  pretaxUsd: number | null,
  taxUsd: number | null,
): number | null {
  if (operatingIncomeUsd == null || !Number.isFinite(operatingIncomeUsd)) return null
  const t = effektiverSteuersatz(pretaxUsd, taxUsd)
  return (operatingIncomeUsd * (1 - t)) / 1_000_000
}

export function icMioAusBilanz(
  equityUsd: number | null,
  debtUsd: number | null,
  cashUsd: number | null,
): number | null {
  if (equityUsd == null || !Number.isFinite(equityUsd)) return null
  return (equityUsd + (debtUsd ?? 0) - (cashUsd ?? 0)) / 1_000_000
}

export function roiicPct(aktuell: JahrSnap, basis: JahrSnap): number | null {
  const dNopat = aktuell.nopatMio - basis.nopatMio
  const dIc = aktuell.icMio - basis.icMio
  // Nur bei Kapitalzufuhr — sonst Buyback-Artefakt
  if (dIc < 5) return null
  const pct = (dNopat / dIc) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) > 2_000) return null
  return Math.round(pct * 10) / 10
}

/** Wenn ΔIC durch Buybacks kollabiert: ΔNOPAT / kumulative Netto-Reinvestition (CapEx − D&A). */
export function roiicPctAusReinvestition(
  aktuell: JahrSnap & { capexMio?: number | null; daMio?: number | null },
  basis: JahrSnap,
  dazwischen: Array<{ capexMio?: number | null; daMio?: number | null }>,
): number | null {
  const dNopat = aktuell.nopatMio - basis.nopatMio
  let reinvest = 0
  for (const s of [...dazwischen, aktuell]) {
    const capex = s.capexMio != null ? Math.abs(s.capexMio) : null
    const da = s.daMio != null ? Math.abs(s.daMio) : 0
    if (capex == null) continue
    reinvest += Math.max(capex - da, 0)
  }
  if (reinvest < 5) return null
  const pct = (dNopat / reinvest) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) > 2_000) return null
  return Math.round(pct * 10) / 10
}

export type JahrSnapErweitert = JahrSnap & {
  capexMio?: number | null
  daMio?: number | null
}

export function paketAusSnaps(
  snaps: JahrSnapErweitert[],
  quelle: 'yahoo' | 'nasdaq' | 'stockanalysis',
): IncrementalRoicPaket {
  if (snaps.length < 2) {
    return {
      incrementalRoicPct: null,
      incrementalRoic1yPct: null,
      incrementalRoic5yPct: null,
      fensterJahre: null,
      quelle: null,
    }
  }
  const last = snaps[snaps.length - 1]!
  const prev = snaps[snaps.length - 2]!
  let y1 = roiicPct(last, prev)
  if (y1 == null) {
    y1 = roiicPctAusReinvestition(last, prev, [])
  }

  let y5: number | null = null
  let fenster5 = 0
  for (const span of [5, 4, 3, 2]) {
    const basisIdx = snaps.findIndex((s) => s.jahr === last.jahr - span)
    const basis =
      basisIdx >= 0 ? snaps[basisIdx]! : snaps[Math.max(0, snaps.length - 1 - span)]
    if (!basis || basis.jahr >= last.jahr) continue
    let hit = roiicPct(last, basis)
    if (hit == null) {
      const dazwischen = snaps.filter((s) => s.jahr > basis.jahr && s.jahr <= last.jahr)
      hit = roiicPctAusReinvestition(last, basis, dazwischen)
    }
    if (hit != null) {
      y5 = hit
      fenster5 = last.jahr - basis.jahr
      break
    }
  }

  // Auch frühestes→letztes Jahr versuchen (längstes Fenster mit ΔIC≥5)
  if (y5 == null && snaps.length >= 3) {
    const earliest = snaps[0]!
    let hit = roiicPct(last, earliest)
    if (hit == null) {
      hit = roiicPctAusReinvestition(
        last,
        earliest,
        snaps.filter((s) => s.jahr > earliest.jahr && s.jahr <= last.jahr),
      )
    }
    if (hit != null) {
      y5 = hit
      fenster5 = last.jahr - earliest.jahr
    }
  }

  const incrementalRoicPct =
    y5 != null ? y5 : y1 != null && Math.abs(y1) <= 100 ? y1 : null

  return {
    incrementalRoicPct,
    incrementalRoic1yPct: y1,
    incrementalRoic5yPct: y5,
    fensterJahre: y5 != null ? fenster5 : incrementalRoicPct != null ? 1 : null,
    quelle: incrementalRoicPct != null ? quelle : null,
  }
}

export function snapsAusYahoo(hist: YahooJahresSnapshot[]): JahrSnapErweitert[] {
  const out: JahrSnapErweitert[] = []
  for (const s of hist) {
    const jahr = parseInt(s.datum.slice(0, 4), 10)
    if (!Number.isFinite(jahr)) continue
    const nopat = nopatMioAusOperating(s.operatingIncomeUsd, s.pretaxIncomeUsd, s.taxProvisionUsd)
    const ic = icMioAusBilanz(s.stockholdersEquityUsd, s.totalDebtUsd, s.cashAndEquivalentsUsd)
    if (nopat == null || ic == null) continue
    out.push({
      jahr,
      nopatMio: nopat,
      icMio: ic,
      capexMio:
        s.capitalExpenditureUsd != null ? Math.abs(s.capitalExpenditureUsd) / 1_000_000 : null,
      daMio:
        s.depreciationAmortizationUsd != null
          ? Math.abs(s.depreciationAmortizationUsd) / 1_000_000
          : null,
    })
  }
  return out.sort((a, b) => a.jahr - b.jahr)
}

export function berechneIncrementalRoicAusYahoo(
  hist: YahooJahresSnapshot[] | null | undefined,
): IncrementalRoicPaket {
  if (!hist?.length) {
    return {
      incrementalRoicPct: null,
      incrementalRoic1yPct: null,
      incrementalRoic5yPct: null,
      fensterJahre: null,
      quelle: null,
    }
  }
  return paketAusSnaps(snapsAusYahoo(hist), 'yahoo')
}

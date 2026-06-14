import { gewichtungAusSlices, type GewichtungEintrag } from '@/lib/portfolio-analyse/gewichtung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import type { SinglePortfolioReport } from '@/lib/portfolio-analyse/parqet-core/types'

/** X-Ray: Look-through — ETFs verschwinden, Einzelwerte werden zusammengeführt. */
export function gewichtungMitXray(
  report: SinglePortfolioReport | null,
  xrayAn: boolean,
): { eintraege: GewichtungEintrag[]; istLookthrough: boolean } {
  if (!report || !xrayAn) {
    return { eintraege: [], istLookthrough: false }
  }

  const slices = report.xRay.topHoldings.filter((h) => h.valueEUR > 0 || h.weightPercent > 0)
  if (slices.length === 0) {
    return { eintraege: [], istLookthrough: false }
  }

  const etfAnzahl = report.holdings.filter((h) => h.assetType === 'ETF').length
  const istLookthrough = slices.length > report.holdings.length - etfAnzahl || etfAnzahl > 0
  return {
    eintraege: gewichtungAusSlices(slices),
    istLookthrough,
  }
}

export function xraySektoren(report: SinglePortfolioReport | null, xrayAn: boolean) {
  if (!report || !xrayAn) return []
  return gewichtungAusSlices(
    report.xRay.sectors.filter((s) => s.valueEUR > 0 && s.label !== 'Unbekannt'),
  )
}

export function xrayLaender(report: SinglePortfolioReport | null, xrayAn: boolean) {
  if (!report || !xrayAn) return []
  return gewichtungAusSlices(
    report.xRay.countries.filter((c) => c.valueEUR > 0 && c.label !== 'Unbekannt'),
  )
}

export function etfOhneBreakdown(
  positionen: LivePosition[],
  etfBreakdowns: Map<string, EtfBreakdown>,
): LivePosition[] {
  return positionen.filter(
    (p) =>
      p.assetKlasse === 'etf' &&
      p.isin &&
      p.wertLiveEur > 0 &&
      !etfBreakdowns.has(p.isin.trim().toUpperCase()),
  )
}

/** Portfolio-Chart-Metriken (Performance-Dropdown). */

export enum PortfolioMetric {
  TTWROR = 'TTWROR',
  ABSOLUTE = 'ABSOLUTE',
  IRR = 'IRR',
  KURSGEWINN = 'KURSGEWINN',
  DIVIDENDEN = 'DIVIDENDEN',
  REALISIERT = 'REALISIERT',
}

export type MetrikEinheit = 'eur' | 'prozent'

export const PORTFOLIO_METRIC_OPTIONS: { value: PortfolioMetric; label: string }[] = [
  { value: PortfolioMetric.TTWROR, label: 'Rendite' },
  { value: PortfolioMetric.ABSOLUTE, label: 'Absoluter Ertrag' },
  { value: PortfolioMetric.IRR, label: 'Interner Zinsfuß (IZF)' },
  { value: PortfolioMetric.KURSGEWINN, label: 'Kursgewinn' },
  { value: PortfolioMetric.DIVIDENDEN, label: 'Dividenden' },
  { value: PortfolioMetric.REALISIERT, label: 'Realisierte Gewinne' },
]

export function metrikIstProzent(metric: PortfolioMetric): boolean {
  return metric === PortfolioMetric.TTWROR || metric === PortfolioMetric.IRR
}

export function metrikEinheit(metric: PortfolioMetric): MetrikEinheit {
  return metrikIstProzent(metric) ? 'prozent' : 'eur'
}

/** Toggle „Dividenden/realisiert“ gilt nur für TTWROR. */
export function metrikNutztDivRealisiertToggle(metric: PortfolioMetric): boolean {
  return metric === PortfolioMetric.TTWROR
}

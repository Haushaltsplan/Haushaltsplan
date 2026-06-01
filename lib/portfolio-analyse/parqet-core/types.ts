/** Eingangsmodell — bereits validiert/importiert (Parqet-Klon). */

export type PortfolioType = 'Standard' | 'Crypto' | 'Watchlist' | 'RealEstate'

export type ParqetAssetType = 'Aktie' | 'ETF' | 'Krypto' | 'Sachwert' | 'Cash'

export type CashflowType = 'IN' | 'OUT' | 'DIVIDEND'

export interface AssetCashflow {
  timestamp: Date
  amountEUR: number
  type: CashflowType
}

export interface EtfBreakdownSlice {
  name?: string
  countryCode?: string
  sectorName?: string
  percentage: number
}

export interface EtfBreakdown {
  topHoldings: Array<{ name: string; percentage: number }>
  countries: Array<{ countryCode: string; percentage: number }>
  sectors: Array<{ sectorName: string; percentage: number }>
}

export interface AssetHolding {
  assetId: string
  assetName: string
  assetType: ParqetAssetType
  quantity: number
  averagePrice: number
  currentPrice: number
  totalDividendsGross: number
  totalDividendsNet: number
  realizedGainsEUR: number
  totalFeesEUR: number
  totalTaxesEUR: number
  cashflows: AssetCashflow[]
  /** Optional für X-Ray bei Einzelaktien (nicht im ETF-Breakdown). */
  countryCode?: string
  sectorName?: string
  etfBreakdown?: EtfBreakdown
}

export interface PortfolioSlice {
  portfolioId: string
  portfolioName: string
  type: PortfolioType
  assets: AssetHolding[]
}

export interface PortfolioData {
  portfolios: PortfolioSlice[]
  taxFreeAmountRemainingEUR: number
}

/** Frontend-taugliche Buckets (Kreisdiagramme, Tabellen). */
export interface AllocationSlice {
  key: string
  label: string
  valueEUR: number
  weightPercent: number
  colorHint?: string
}

export interface TimeSeriesPoint {
  date: string
  valueEUR: number
  /** TWR kumuliert ab Start (100 = Basis). */
  twrIndex: number
  /** Für Benchmark-Overlay (gleiche Basis 100). */
  performanceIndex: number
}

export interface PeriodPerformance {
  periodKey: '1T' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1J' | '3J' | '5J' | 'MAX'
  twrPercent: number | null
  valueChangeEUR: number
  valueChangePercent: number | null
}

export interface DividendPeriodBucket {
  period: string
  grossEUR: number
  netEUR: number
}

export interface DividendForecastMonth {
  month: string
  expectedGrossEUR: number
  expectedNetEUR: number
}

export interface AssetYieldOnCost {
  assetId: string
  assetName: string
  yieldOnCostGrossPercent: number | null
  yieldOnCostNetPercent: number | null
  trailing12mDividendGrossEUR: number
  trailing12mDividendNetEUR: number
}

export interface ConcentrationRisk {
  dimension: 'holding' | 'country' | 'sector'
  key: string
  label: string
  effectiveWeightPercent: number
}

export interface PortfolioScopeMetrics {
  scopeId: string
  scopeName: string
  marketValueEUR: number
  costBasisEUR: number
  unrealizedGainEUR: number
  unrealizedGainPercent: number | null
  realizedGainsEUR: number
  totalDividendsGrossEUR: number
  totalDividendsNetEUR: number
  totalFeesEUR: number
  totalTaxesEUR: number
  netExternalFlowsEUR: number
  trueNetWorthEUR: number
  positionCount: number
}

export interface PerformanceBlock {
  /** Annualisierter IZF (IRR) in % — Newton-Raphson, Terminal = Marktwert heute. */
  irrAnnualizedPercent: number | null
  /** Gesamt-TWR seit erstem Cashflow in %. */
  twrTotalPercent: number | null
  twrCurve: TimeSeriesPoint[]
  periodReturns: PeriodPerformance[]
  /** Normalisierte Reihe (Start = 100) für Benchmark-Overlay im Frontend. */
  benchmarkOverlayBase100: TimeSeriesPoint[]
}

export interface XRayBlock {
  topHoldings: AllocationSlice[]
  countries: AllocationSlice[]
  sectors: AllocationSlice[]
  concentrationRisks: ConcentrationRisk[]
}

export interface DividendsBlock {
  byYear: DividendPeriodBucket[]
  byMonth: DividendPeriodBucket[]
  byQuarter: DividendPeriodBucket[]
  forecastNext12Months: DividendForecastMonth[]
  portfolioYieldOnCostGrossPercent: number | null
  portfolioYieldOnCostNetPercent: number | null
  perAsset: AssetYieldOnCost[]
}

export interface TaxFeesBlock {
  totalTaxesPaidEUR: number
  totalFeesPaidEUR: number
  realizedGainsEUR: number
  taxFreeAllowanceTotalEUR: number
  taxFreeRemainingEUR: number
  taxFreeUsedEUR: number
  estimatedTaxOnUnrealizedEUR: number
  portfolioTerPercent: number | null
  feeDragEUR: number
}

export interface AllocationBlock {
  byAssetClass: AllocationSlice[]
  byCountry: AllocationSlice[]
  bySector: AllocationSlice[]
}

export interface TimeSeriesBlock {
  daily: TimeSeriesPoint[]
  weekly: TimeSeriesPoint[]
  byPeriod: Record<PeriodPerformance['periodKey'], TimeSeriesPoint[]>
}

export interface SinglePortfolioReport {
  metrics: PortfolioScopeMetrics
  performance: PerformanceBlock
  xRay: XRayBlock
  dividends: DividendsBlock
  allocation: AllocationBlock
  taxFees: TaxFeesBlock
  holdings: Array<{
    assetId: string
    assetName: string
    assetType: ParqetAssetType
    marketValueEUR: number
    weightPercent: number
    gainEUR: number
    gainPercent: number | null
  }>
}

/** Vollständiger Parqet-Analytics-Report für alle Dashboards. */
export interface UltimateParqetReport {
  generatedAt: string
  taxFreeAmountRemainingEUR: number
  consolidated: SinglePortfolioReport
  portfolios: SinglePortfolioReport[]
  timeSeries: TimeSeriesBlock
}

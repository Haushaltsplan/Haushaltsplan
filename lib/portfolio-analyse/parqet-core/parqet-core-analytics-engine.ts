import {
  berechneIrrAnnualizedPercent,
  bucketsToAllocationSlices,
  clamp,
  daysBetween,
  mergeWeightedBuckets,
  parseIsoDate,
  round2,
  safeDiv,
  toIsoDate,
} from '@/lib/portfolio-analyse/parqet-core/math-utils'
import type {
  AllocationSlice,
  AssetHolding,
  ConcentrationRisk,
  DividendForecastMonth,
  DividendPeriodBucket,
  DividendsBlock,
  PerformanceBlock,
  PeriodPerformance,
  PortfolioData,
  PortfolioScopeMetrics,
  SinglePortfolioReport,
  TaxFeesBlock,
  TimeSeriesBlock,
  TimeSeriesPoint,
  UltimateParqetReport,
  XRayBlock,
} from '@/lib/portfolio-analyse/parqet-core/types'

const ASSET_CLASS_COLORS: Record<string, string> = {
  Aktie: '#6366f1',
  ETF: '#22d3ee',
  Krypto: '#fbbf24',
  Sachwert: '#a78bfa',
  Cash: '#34d399',
}

type ScopedAssets = {
  scopeId: string
  scopeName: string
  assets: AssetHolding[]
}

/**
 * Parqet Core Analytics — berechnet konsolidierte und depotweise Kennzahlen,
 * Performance (IZF/TWR), X-Ray, Dividenden, Allokation, Steuern/Gebühren und Zeitreihen.
 */
export class ParqetCoreAnalyticsEngine {
  private readonly data: PortfolioData
  private readonly asOf: Date

  constructor(data: PortfolioData, asOf: Date = new Date()) {
    this.data = data
    this.asOf = asOf
  }

  /** Haupt-Entry: vollständiger Report für alle Parqet-Dashboards. */
  public generateUltimateReport(): UltimateParqetReport {
    const consolidatedAssets = this.flattenAssets()
    const consolidated = this.buildPortfolioReport({
      scopeId: '__consolidated__',
      scopeName: 'Gesamtvermögen',
      assets: consolidatedAssets,
    })

    const portfolios = this.data.portfolios.map((p) =>
      this.buildPortfolioReport({
        scopeId: p.portfolioId,
        scopeName: p.portfolioName,
        assets: p.assets,
      }),
    )

    const timeSeries = this.buildGlobalTimeSeries(consolidatedAssets, consolidated.metrics.marketValueEUR)

    return {
      generatedAt: this.asOf.toISOString(),
      taxFreeAmountRemainingEUR: round2(this.data.taxFreeAmountRemainingEUR),
      consolidated,
      portfolios,
      timeSeries,
    }
  }

  /** Metriken für ein einzelnes Portfolio. */
  public metricsForPortfolio(portfolioId: string): PortfolioScopeMetrics | null {
    const p = this.data.portfolios.find((x) => x.portfolioId === portfolioId)
    if (!p) return null
    return this.buildPortfolioReport({
      scopeId: p.portfolioId,
      scopeName: p.portfolioName,
      assets: p.assets,
    }).metrics
  }

  /** Metriken Gesamtvermögen (alle Portfolios). */
  public consolidatedMetrics(): PortfolioScopeMetrics {
    return this.buildPortfolioReport({
      scopeId: '__consolidated__',
      scopeName: 'Gesamtvermögen',
      assets: this.flattenAssets(),
    }).metrics
  }

  private flattenAssets(): AssetHolding[] {
    return this.data.portfolios.flatMap((p) => p.assets)
  }

  private buildPortfolioReport(scope: ScopedAssets): SinglePortfolioReport {
    const metrics = this.computeScopeMetrics(scope)
    const performance = this.computePerformance(scope, metrics.marketValueEUR)
    const xRay = this.computeXRay(scope.assets, metrics.marketValueEUR)
    const dividends = this.computeDividends(scope.assets, metrics.costBasisEUR)
    const allocation = this.computeAllocation(scope.assets, metrics.marketValueEUR, xRay)
    const taxFees = this.computeTaxFees(scope, metrics)
    const holdings = scope.assets
      .map((a) => {
        const mv = this.marketValue(a)
        const cost = this.costBasis(a)
        const gain = round2(mv - cost)
        return {
          assetId: a.assetId,
          assetName: a.assetName,
          assetType: a.assetType,
          marketValueEUR: mv,
          weightPercent: round2(safeDiv(mv * 100, metrics.marketValueEUR, 0)),
          gainEUR: gain,
          gainPercent: cost > 0 ? round2(safeDiv(gain * 100, cost, 0)) : null,
        }
      })
      .filter((h) => h.marketValueEUR > 0)
      .sort((a, b) => b.marketValueEUR - a.marketValueEUR)

    return {
      metrics,
      performance,
      xRay,
      dividends,
      allocation,
      taxFees,
      holdings,
    }
  }

  // —— 1. Net Worth ——

  private computeScopeMetrics(scope: ScopedAssets): PortfolioScopeMetrics {
    let marketValueEUR = 0
    let costBasisEUR = 0
    let realizedGainsEUR = 0
    let totalDividendsGrossEUR = 0
    let totalDividendsNetEUR = 0
    let totalFeesEUR = 0
    let totalTaxesEUR = 0
    let netExternalFlowsEUR = 0
    let positionCount = 0

    for (const a of scope.assets) {
      const mv = this.marketValue(a)
      if (mv <= 0 && a.quantity <= 0) continue
      positionCount++
      marketValueEUR += mv
      costBasisEUR += this.costBasis(a)
      realizedGainsEUR += a.realizedGainsEUR
      totalDividendsGrossEUR += a.totalDividendsGross
      totalDividendsNetEUR += a.totalDividendsNet
      totalFeesEUR += a.totalFeesEUR
      totalTaxesEUR += a.totalTaxesEUR
      netExternalFlowsEUR += this.netExternalFlowsAsset(a)
    }

    marketValueEUR = round2(marketValueEUR)
    costBasisEUR = round2(costBasisEUR)
    const unrealizedGainEUR = round2(marketValueEUR - costBasisEUR)
    const unrealizedGainPercent =
      costBasisEUR > 0 ? round2(safeDiv(unrealizedGainEUR * 100, costBasisEUR, 0)) : null

    /** True Net Worth: Marktwert minus geschätzter Steuerlast auf unrealisierte Gewinne (vereinfacht). */
    const estimatedTaxOnUnrealized = round2(
      Math.max(0, unrealizedGainEUR) * safeDiv(totalTaxesEUR, Math.max(realizedGainsEUR, 1), 0.26),
    )
    const trueNetWorthEUR = round2(Math.max(0, marketValueEUR - estimatedTaxOnUnrealized))

    return {
      scopeId: scope.scopeId,
      scopeName: scope.scopeName,
      marketValueEUR,
      costBasisEUR,
      unrealizedGainEUR,
      unrealizedGainPercent,
      realizedGainsEUR: round2(realizedGainsEUR),
      totalDividendsGrossEUR: round2(totalDividendsGrossEUR),
      totalDividendsNetEUR: round2(totalDividendsNetEUR),
      totalFeesEUR: round2(totalFeesEUR),
      totalTaxesEUR: round2(totalTaxesEUR),
      netExternalFlowsEUR: round2(netExternalFlowsEUR),
      trueNetWorthEUR,
      positionCount,
    }
  }

  private marketValue(a: AssetHolding): number {
    if (!Number.isFinite(a.quantity) || !Number.isFinite(a.currentPrice)) return 0
    if (a.quantity <= 0) return 0
    return round2(a.quantity * a.currentPrice)
  }

  private costBasis(a: AssetHolding): number {
    if (a.quantity <= 0 || !Number.isFinite(a.averagePrice)) return 0
    return round2(a.quantity * a.averagePrice)
  }

  private netExternalFlowsAsset(a: AssetHolding): number {
    let net = 0
    for (const cf of a.cashflows) {
      if (cf.type === 'IN') net += cf.amountEUR
      if (cf.type === 'OUT') net -= cf.amountEUR
    }
    return net
  }

  // —— 2. Performance (IZF & TWR) ——

  private computePerformance(scope: ScopedAssets, marketValueEUR: number): PerformanceBlock {
    const irrFlows = this.aggregateCashflowsForIrr(scope.assets)
    const irrAnnualizedPercent = berechneIrrAnnualizedPercent(irrFlows, marketValueEUR, this.asOf)

    const twrCurve = this.computeTwrCurve(scope.assets, marketValueEUR)
    const twrTotalPercent =
      twrCurve.length >= 2
        ? round2(safeDiv(twrCurve[twrCurve.length - 1].twrIndex - 100, 100, 0) * 100)
        : null

    const benchmarkOverlayBase100 = twrCurve.map((p) => ({
      date: p.date,
      valueEUR: p.valueEUR,
      twrIndex: p.twrIndex,
      performanceIndex: p.performanceIndex,
    }))

    const periodReturns = this.periodReturnsFromCurve(twrCurve, marketValueEUR)

    return {
      irrAnnualizedPercent,
      twrTotalPercent,
      twrCurve,
      periodReturns,
      benchmarkOverlayBase100,
    }
  }

  /**
   * IZF wie Parqet (Depot): Wertpapier-Käufe (OUT), Dividenden, Cash-Einzahlung nur ohne Käufe,
   * Auszahlungen (IN), keine Verkaufs-Flows.
   */
  private aggregateCashflowsForIrr(assets: AssetHolding[]): Array<{ date: Date; amount: number }> {
    const PORTFOLIO_CASH_ID = '__portfolio_cash__'
    let hatSecurityOut = false
    for (const a of assets) {
      if (a.assetId === PORTFOLIO_CASH_ID) continue
      if (a.cashflows.some((cf) => cf.type === 'OUT')) {
        hatSecurityOut = true
        break
      }
    }

    const out: Array<{ date: Date; amount: number }> = []
    for (const a of assets) {
      const isCash = a.assetId === PORTFOLIO_CASH_ID
      for (const cf of a.cashflows) {
        if (cf.type === 'DIVIDEND') {
          out.push({ date: cf.timestamp, amount: Math.abs(cf.amountEUR) })
        } else if (cf.type === 'OUT' && !isCash) {
          out.push({ date: cf.timestamp, amount: -Math.abs(cf.amountEUR) })
        } else if (cf.type === 'OUT' && isCash && !hatSecurityOut) {
          out.push({ date: cf.timestamp, amount: -Math.abs(cf.amountEUR) })
        } else if (cf.type === 'IN' && isCash) {
          out.push({ date: cf.timestamp, amount: Math.abs(cf.amountEUR) })
        }
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  /**
   * Zeitgewichtete Rendite (TWR):
   * Subperioden zwischen externen Cashflows (IN/OUT).
   * Zwischen Flows: Wertentwicklung proportional vom letzten Mark-to-Market.
   * Mathematik: r_i = (V_end - V_start - CF_intern) / V_start; TWR = Π(1+r_i)-1.
   */
  private computeTwrCurve(assets: AssetHolding[], terminalValueEUR: number): TimeSeriesPoint[] {
    const externalEvents: Array<{ date: Date; amountEUR: number }> = []
    for (const a of assets) {
      for (const cf of a.cashflows) {
        if (cf.type === 'IN' || cf.type === 'OUT') {
          externalEvents.push({ date: cf.timestamp, amountEUR: cf.type === 'IN' ? cf.amountEUR : -cf.amountEUR })
        }
      }
    }
    externalEvents.sort((a, b) => a.date.getTime() - b.date.getTime())

    if (externalEvents.length === 0 && terminalValueEUR <= 0) {
      return []
    }

    const startDate = externalEvents.length > 0 ? externalEvents[0].date : this.asOf
    const netInvested = externalEvents.reduce((s, e) => s + e.amountEUR, 0)
    const growthFactor = safeDiv(terminalValueEUR, Math.max(netInvested, 1), 1)

    /** Tägliche Stützpunkte: interpolierter Wert zwischen Flows. */
    const endMs = this.asOf.getTime()
    const startMs = startDate.getTime()
    const dayMs = 86400000
    const points: TimeSeriesPoint[] = []

    let cumNet = 0
    let eventIdx = 0
    let twrIndex = 100

    for (let t = startMs; t <= endMs; t += dayMs) {
      const d = new Date(t)
      while (eventIdx < externalEvents.length && externalEvents[eventIdx].date.getTime() <= t) {
        cumNet += externalEvents[eventIdx].amountEUR
        eventIdx++
      }
      const estimatedValue = round2(Math.max(0, cumNet * growthFactor))
      points.push({
        date: toIsoDate(d),
        valueEUR: estimatedValue,
        twrIndex,
        performanceIndex: twrIndex,
      })
    }

    if (points.length > 0) {
      points[points.length - 1].valueEUR = round2(terminalValueEUR)
    }

    /** TWR-Index aus Subperioden mit externen Flows neu verketten. */
    let prevValue = 0
    let prevIndex = 100
    eventIdx = 0
    cumNet = 0

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const t = parseIsoDate(p.date).getTime()
      while (eventIdx < externalEvents.length && externalEvents[eventIdx].date.getTime() <= t) {
        const flow = externalEvents[eventIdx].amountEUR
        const vBefore = prevValue > 0 ? prevValue : Math.max(cumNet, 1)
        const r = safeDiv(p.valueEUR - vBefore - flow, vBefore, 0)
        prevIndex = prevIndex * (1 + r)
        cumNet += flow
        prevValue = p.valueEUR
        eventIdx++
      }
      p.twrIndex = round2(prevIndex)
      p.performanceIndex = round2(prevIndex)
      prevValue = p.valueEUR
    }

    return this.downsampleSeries(points, 400)
  }

  private periodReturnsFromCurve(curve: TimeSeriesPoint[], currentValue: number): PeriodPerformance[] {
    const periods: PeriodPerformance['periodKey'][] = ['1T', '1W', '1M', '3M', '6M', 'YTD', '1J', '3J', '5J', 'MAX']
    const now = this.asOf
    const msDay = 86400000

    const offsets: Record<PeriodPerformance['periodKey'], number> = {
      '1T': 1,
      '1W': 7,
      '1M': 30,
      '3M': 91,
      '6M': 182,
      'YTD': daysBetween(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), now),
      '1J': 365,
      '3J': 365 * 3,
      '5J': 365 * 5,
      MAX: 365 * 50,
    }

    const last = curve.length > 0 ? curve[curve.length - 1] : null

    return periods.map((periodKey) => {
      const days = offsets[periodKey]
      const cutoff = new Date(now.getTime() - days * msDay)
      const cutoffIso = toIsoDate(cutoff)
      const startPoint = curve.find((p) => p.date >= cutoffIso) ?? curve[0]
      if (!startPoint || !last) {
        return { periodKey, twrPercent: null, valueChangeEUR: 0, valueChangePercent: null }
      }
      const twrPercent = round2(safeDiv(last.twrIndex - startPoint.twrIndex, startPoint.twrIndex, 0) * 100)
      const valueChangeEUR = round2(currentValue - startPoint.valueEUR)
      const valueChangePercent = round2(
        safeDiv(valueChangeEUR * 100, startPoint.valueEUR, 0),
      )
      return { periodKey, twrPercent, valueChangeEUR, valueChangePercent }
    })
  }

  // —— 3. X-Ray ——

  private computeXRay(assets: AssetHolding[], totalMarketValueEUR: number): XRayBlock {
    const holdingsMap = new Map<string, { label: string; weight: number }>()
    const countriesMap = new Map<string, { label: string; weight: number }>()
    const sectorsMap = new Map<string, { label: string; weight: number }>()

    for (const a of assets) {
      const mv = this.marketValue(a)
      if (mv <= 0) continue
      const weightPercent = safeDiv(mv * 100, totalMarketValueEUR, 0)

      if (a.assetType === 'ETF' && a.etfBreakdown) {
        mergeWeightedBuckets(
          holdingsMap,
          a.etfBreakdown.topHoldings.map((h) => ({ key: h.name, label: h.name, percentage: h.percentage })),
          weightPercent,
        )
        mergeWeightedBuckets(
          countriesMap,
          a.etfBreakdown.countries.map((c) => ({
            key: c.countryCode,
            label: c.countryCode,
            percentage: c.percentage,
          })),
          weightPercent,
        )
        mergeWeightedBuckets(
          sectorsMap,
          a.etfBreakdown.sectors.map((s) => ({
            key: s.sectorName,
            label: s.sectorName,
            percentage: s.percentage,
          })),
          weightPercent,
        )
      } else {
        mergeWeightedBuckets(
          holdingsMap,
          [{ key: a.assetId, label: a.assetName, percentage: 100 }],
          weightPercent,
        )
        const country = a.countryCode?.trim() || 'Unbekannt'
        const sector = a.sectorName?.trim() || 'Unbekannt'
        mergeWeightedBuckets(countriesMap, [{ key: country, label: country, percentage: 100 }], weightPercent)
        mergeWeightedBuckets(sectorsMap, [{ key: sector, label: sector, percentage: 100 }], weightPercent)
      }
    }

    const topHoldings = bucketsToAllocationSlices(holdingsMap, totalMarketValueEUR)
    const countries = bucketsToAllocationSlices(countriesMap, totalMarketValueEUR)
    const sectors = bucketsToAllocationSlices(sectorsMap, totalMarketValueEUR)

    const concentrationRisks: ConcentrationRisk[] = [
      ...topHoldings.slice(0, 10).map((h) => ({
        dimension: 'holding' as const,
        key: h.key,
        label: h.label,
        effectiveWeightPercent: h.weightPercent,
      })),
      ...countries.filter((c) => c.weightPercent >= 5).map((c) => ({
        dimension: 'country' as const,
        key: c.key,
        label: c.label,
        effectiveWeightPercent: c.weightPercent,
      })),
      ...sectors.filter((s) => s.weightPercent >= 5).map((s) => ({
        dimension: 'sector' as const,
        key: s.key,
        label: s.label,
        effectiveWeightPercent: s.weightPercent,
      })),
    ].sort((a, b) => b.effectiveWeightPercent - a.effectiveWeightPercent)

    return { topHoldings, countries, sectors, concentrationRisks }
  }

  // —— 4. Dividenden ——

  private computeDividends(assets: AssetHolding[], costBasisEUR: number): DividendsBlock {
    const grossByYear = new Map<string, number>()
    const netByYear = new Map<string, number>()
    const grossByMonth = new Map<string, number>()
    const netByMonth = new Map<string, number>()
    const grossByQuarter = new Map<string, number>()
    const netByQuarter = new Map<string, number>()

    const now = this.asOf
    const t12Start = new Date(now.getTime() - 365 * 86400000)

    for (const a of assets) {
      for (const cf of a.cashflows) {
        if (cf.type !== 'DIVIDEND') continue
        const y = String(cf.timestamp.getUTCFullYear())
        const m = `${y}-${String(cf.timestamp.getUTCMonth() + 1).padStart(2, '0')}`
        const q = `${y}-Q${Math.floor(cf.timestamp.getUTCMonth() / 3) + 1}`
        const amt = Math.abs(cf.amountEUR)
        grossByYear.set(y, (grossByYear.get(y) ?? 0) + amt)
        netByYear.set(y, (netByYear.get(y) ?? 0) + amt)
        grossByMonth.set(m, (grossByMonth.get(m) ?? 0) + amt)
        netByMonth.set(m, (netByMonth.get(m) ?? 0) + amt)
        grossByQuarter.set(q, (grossByQuarter.get(q) ?? 0) + amt)
        netByQuarter.set(q, (netByQuarter.get(q) ?? 0) + amt)
      }
    }

    const mapToBuckets = (
      gross: Map<string, number>,
      net: Map<string, number>,
    ): DividendPeriodBucket[] =>
      [...gross.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, grossEUR]) => ({
          period,
          grossEUR: round2(grossEUR),
          netEUR: round2(net.get(period) ?? grossEUR),
        }))

    const trailing12mGross = assets.reduce((s, a) => {
      let t = 0
      for (const cf of a.cashflows) {
        if (cf.type === 'DIVIDEND' && cf.timestamp >= t12Start) t += Math.abs(cf.amountEUR)
      }
      return s + t
    }, 0)

    let trailing12mNet = 0
    for (const a of assets) {
      for (const cf of a.cashflows) {
        if (cf.type === 'DIVIDEND' && cf.timestamp >= t12Start) trailing12mNet += Math.abs(cf.amountEUR)
      }
    }

    const forecastNext12Months = this.dividendForecast(trailing12mGross, trailing12mNet)

    const perAsset = assets.map((a) => {
      const yocGross =
        a.averagePrice > 0 && a.quantity > 0
          ? round2(safeDiv(a.totalDividendsGross * 100, a.quantity * a.averagePrice, 0))
          : null
      const yocNet =
        a.averagePrice > 0 && a.quantity > 0
          ? round2(safeDiv(a.totalDividendsNet * 100, a.quantity * a.averagePrice, 0))
          : null
      return {
        assetId: a.assetId,
        assetName: a.assetName,
        yieldOnCostGrossPercent: yocGross,
        yieldOnCostNetPercent: yocNet,
        trailing12mDividendGrossEUR: round2(a.totalDividendsGross),
        trailing12mDividendNetEUR: round2(a.totalDividendsNet),
      }
    })

    const portfolioYieldOnCostGrossPercent =
      costBasisEUR > 0 ? round2(safeDiv(trailing12mGross * 100, costBasisEUR, 0)) : null

    return {
      byYear: mapToBuckets(grossByYear, netByYear),
      byMonth: mapToBuckets(grossByMonth, netByMonth),
      byQuarter: mapToBuckets(grossByQuarter, netByQuarter),
      forecastNext12Months,
      portfolioYieldOnCostGrossPercent,
      portfolioYieldOnCostNetPercent: portfolioYieldOnCostGrossPercent,
      perAsset,
    }
  }

  /** Prognose: gleichmäßige Verteilung der TTM-Dividende auf 12 Monate. */
  private dividendForecast(trailing12mGross: number, trailing12mNet: number): DividendForecastMonth[] {
    const monthlyGross = safeDiv(trailing12mGross, 12, 0)
    const monthlyNet = safeDiv(trailing12mNet, 12, 0)
    const out: DividendForecastMonth[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(this.asOf.getUTCFullYear(), this.asOf.getUTCMonth() + i + 1, 1))
      out.push({
        month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        expectedGrossEUR: round2(monthlyGross),
        expectedNetEUR: round2(monthlyNet),
      })
    }
    return out
  }

  // —— 5. Allokation ——

  private computeAllocation(
    assets: AssetHolding[],
    totalMarketValueEUR: number,
    xRay: XRayBlock,
  ): import('@/lib/portfolio-analyse/parqet-core/types').AllocationBlock {
    const byClass = new Map<string, number>()
    for (const a of assets) {
      const mv = this.marketValue(a)
      if (mv <= 0) continue
      byClass.set(a.assetType, (byClass.get(a.assetType) ?? 0) + mv)
    }

    const byAssetClass: AllocationSlice[] = [...byClass.entries()]
      .map(([key, valueEUR]) => ({
        key,
        label: key,
        valueEUR: round2(valueEUR),
        weightPercent: round2(safeDiv(valueEUR * 100, totalMarketValueEUR, 0)),
        colorHint: ASSET_CLASS_COLORS[key],
      }))
      .sort((a, b) => b.valueEUR - a.valueEUR)

    return {
      byAssetClass,
      byCountry: xRay.countries,
      bySector: xRay.sectors,
    }
  }

  // —— 6. Steuern & Gebühren ——

  private computeTaxFees(scope: ScopedAssets, metrics: PortfolioScopeMetrics): TaxFeesBlock {
    const taxFreeAllowanceTotalEUR = 1000
    const realizedGainsEUR = metrics.realizedGainsEUR
    const taxFreeUsedEUR = round2(clamp(realizedGainsEUR, 0, taxFreeAllowanceTotalEUR))
    const taxFreeRemainingEUR = round2(this.data.taxFreeAmountRemainingEUR)

    const portfolioTerPercent =
      metrics.marketValueEUR > 0
        ? round2(safeDiv(metrics.totalFeesEUR * 100, metrics.marketValueEUR, 0))
        : null

    const estimatedTaxOnUnrealizedEUR = round2(
      Math.max(0, metrics.unrealizedGainEUR) *
        safeDiv(metrics.totalTaxesEUR, Math.max(metrics.realizedGainsEUR, 1), 0.26),
    )

    return {
      totalTaxesPaidEUR: metrics.totalTaxesEUR,
      totalFeesPaidEUR: metrics.totalFeesEUR,
      realizedGainsEUR,
      taxFreeAllowanceTotalEUR,
      taxFreeRemainingEUR,
      taxFreeUsedEUR,
      estimatedTaxOnUnrealizedEUR,
      portfolioTerPercent,
      feeDragEUR: metrics.totalFeesEUR,
    }
  }

  // —— 7. Zeitreihen global ——

  private buildGlobalTimeSeries(assets: AssetHolding[], marketValueEUR: number): TimeSeriesBlock {
    const daily = this.computeTwrCurve(assets, marketValueEUR)
    const weekly = this.downsampleSeries(
      daily.filter((_, i) => i % 7 === 0),
      520,
    )

    const periodKeys: PeriodPerformance['periodKey'][] = ['1T', '1W', '1M', '3M', '6M', 'YTD', '1J', '3J', '5J', 'MAX']
    const byPeriod = {} as TimeSeriesBlock['byPeriod']
    for (const key of periodKeys) {
      const daysMap: Record<PeriodPerformance['periodKey'], number> = {
        '1T': 1,
        '1W': 7,
        '1M': 30,
        '3M': 91,
        '6M': 182,
        YTD: daysBetween(new Date(Date.UTC(this.asOf.getUTCFullYear(), 0, 1)), this.asOf),
        '1J': 365,
        '3J': 365 * 3,
        '5J': 365 * 5,
        MAX: 365 * 50,
      }
      const cutoff = new Date(this.asOf.getTime() - daysMap[key] * 86400000)
      const cutoffIso = toIsoDate(cutoff)
      byPeriod[key] = daily.filter((p) => p.date >= cutoffIso)
    }

    return { daily, weekly, byPeriod }
  }

  private downsampleSeries(points: TimeSeriesPoint[], maxPoints: number): TimeSeriesPoint[] {
    if (points.length <= maxPoints) return points
    const step = Math.ceil(points.length / maxPoints)
    const out: TimeSeriesPoint[] = []
    for (let i = 0; i < points.length; i += step) out.push(points[i])
    if (out[out.length - 1]?.date !== points[points.length - 1].date) {
      out.push(points[points.length - 1])
    }
    return out
  }
}

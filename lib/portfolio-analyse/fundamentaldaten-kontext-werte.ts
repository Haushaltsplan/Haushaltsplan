import { cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  berechneRoiicAusMacrotrendsZeilen,
  historischeWerteAusZeile,
  letzterVerfuegbarerWert,
  schaetzeWaccPct,
  type RoiicErgebnis,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import type { MantraYahooFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'

export type FundamentalKontextInput = {
  yahoo: YahooFundamentalKennzahlen | null
  roh: Pick<MacrotrendsFundamentalRoh, 'perioden' | 'zeilen'> | null
  schaetzungen: FundamentalSchaetzungenRoh
  yahooFinanz: MantraYahooFinanzdaten | null
  /** StockAnalysis ROIIC; sonst Fallback aus Macrotrends EBIT+ROIC. */
  roiic?: RoiicErgebnis | null
}

function historischeWerte(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number[] {
  return historischeWerteAusZeile(zeile, perioden)
}

function letzterWert(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number | null {
  return letzterVerfuegbarerWert(zeile, perioden)
}

function berechneMargePct(zaehler: number | null, nenner: number | null): number | null {
  if (zaehler == null || nenner == null || nenner === 0) return null
  return (zaehler / nenner) * 100
}

/** Zentrale Kennzahlen — eine Quelle für Key Metrics und Mantra-Check. */
export function baueKontextWerte(ctx: FundamentalKontextInput) {
  const perioden = ctx.roh?.perioden
  const zeile = (id: string) => ctx.roh?.zeilen.find((z) => z.id === id)

  const umsatzZeile = zeile('umsatz')
  const bruttoGewinnZeile = zeile('bruttogewinn')
  const bruttoMargeZeile = zeile('bruttomarge')
  const ebitZeile = zeile('ebit')
  const ebitMargeZeile = zeile('ebit_marge')
  const ebitdaZeile = zeile('ebitda')
  const ebitdaMargeZeile = zeile('ebitda_marge')
  const nettoZeile = zeile('nettogewinn')
  const epsZeile = zeile('eps')
  const fcfZeile = zeile('fcf')
  const capexZeile = zeile('capex')
  const roiZeile = zeile('roi')
  const roeZeile = zeile('roe')
  const roaZeile = zeile('roa')
  const kapitalumschlagZeile = zeile('kapitalumschlag')
  const aktienZeile = zeile('aktien')
  const sbcZeile = zeile('sbc')
  const rdZeile = zeile('rd')
  const sgaZeile = zeile('sga')
  const dsoZeile = zeile('dso')
  const yt = ctx.yahooFinanz

  const umsatzMio = letzterWert(umsatzZeile, perioden)
  const fcfMio = letzterWert(fcfZeile, perioden)
  const nettoMio = letzterWert(nettoZeile, perioden)
  const capexMio = letzterWert(capexZeile, perioden)
  const ebitdaMio = letzterWert(ebitdaZeile, perioden)
  const ebitMio = letzterWert(ebitZeile, perioden)

  const revenueUsd = yt?.revenueUsd ?? (umsatzMio != null ? umsatzMio * 1_000_000 : null)
  const fcfUsd = yt?.freeCashFlowUsd ?? (fcfMio != null ? fcfMio * 1_000_000 : null)
  const netIncomeUsd = yt?.netIncomeUsd ?? (nettoMio != null ? nettoMio * 1_000_000 : null)
  const sbcUsd =
    yt?.stockBasedCompensationUsd ??
    (letzterWert(sbcZeile, perioden) != null ? letzterWert(sbcZeile, perioden)! * 1_000_000 : null)
  const interestUsd = yt?.interestExpenseUsd ?? null
  const opIncomeUsd = yt?.operatingIncomeUsd ?? (ebitMio != null ? ebitMio * 1_000_000 : null)
  const rdUsd =
    yt?.researchDevelopmentUsd ??
    (letzterWert(rdZeile, perioden) != null ? letzterWert(rdZeile, perioden)! * 1_000_000 : null)
  const sgaUsd =
    yt?.sgaUsd ??
    (letzterWert(sgaZeile, perioden) != null ? letzterWert(sgaZeile, perioden)! * 1_000_000 : null)

  const sbcAdjFcfUsd = fcfUsd != null && sbcUsd != null ? fcfUsd - sbcUsd : null

  const bruttoMarge =
    letzterWert(bruttoMargeZeile, perioden) ??
    berechneMargePct(letzterWert(bruttoGewinnZeile, perioden), umsatzMio) ??
    (ctx.yahoo?.grossMargins != null ? ctx.yahoo.grossMargins * 100 : null)

  const ebitMarge =
    letzterWert(ebitMargeZeile, perioden) ??
    berechneMargePct(letzterWert(ebitZeile, perioden), umsatzMio) ??
    (ctx.yahoo?.operatingMargins != null ? ctx.yahoo.operatingMargins * 100 : null)

  const ebitdaMarge =
    letzterWert(ebitdaMargeZeile, perioden) ??
    berechneMargePct(ebitdaMio, umsatzMio) ??
    (ctx.yahoo?.ebitdaMargins != null ? ctx.yahoo.ebitdaMargins * 100 : null)

  const fcfMarge =
    revenueUsd != null && fcfUsd != null && revenueUsd > 0
      ? (fcfUsd / revenueUsd) * 100
      : berechneMargePct(fcfMio, umsatzMio)
  const sbcAdjFcfMargin =
    revenueUsd != null && sbcAdjFcfUsd != null && revenueUsd > 0
      ? (sbcAdjFcfUsd / revenueUsd) * 100
      : null
  const sbcFcfRatio =
    fcfUsd != null && sbcUsd != null && fcfUsd > 0 ? (sbcUsd / fcfUsd) * 100 : null
  const sbcAdjFcfConversion =
    netIncomeUsd != null && sbcAdjFcfUsd != null && netIncomeUsd > 0
      ? (sbcAdjFcfUsd / netIncomeUsd) * 100
      : null
  const interestCoverage =
    opIncomeUsd != null && interestUsd != null && interestUsd > 0 ? opIncomeUsd / interestUsd : null
  const rdSales = revenueUsd != null && rdUsd != null && revenueUsd > 0 ? (rdUsd / revenueUsd) * 100 : null
  const sgaSales = revenueUsd != null && sgaUsd != null && revenueUsd > 0 ? (sgaUsd / revenueUsd) * 100 : null
  const dsoHist = historischeWerte(dsoZeile, perioden)
  const dsoAktuell = letzterWert(dsoZeile, perioden)
  const capexSales =
    umsatzMio != null && capexMio != null && umsatzMio > 0 ? (Math.abs(capexMio) / umsatzMio) * 100 : null
  const fcfConversion =
    nettoMio != null && fcfMio != null && nettoMio > 0 ? (fcfMio / nettoMio) * 100 : null

  const roic = letzterWert(roiZeile, perioden)
  const roicQuelle = roic != null ? 'ROIC (Macrotrends / StockAnalysis)' : undefined

  const wacc = schaetzeWaccPct({
    beta: ctx.yahoo?.beta,
    marketCapUsd: ctx.yahoo?.marketCap,
    totalDebtUsd: ctx.yahoo?.totalDebt,
    interestExpenseUsd: yt?.interestExpenseUsd,
    pretaxIncomeUsd: yt?.pretaxIncomeUsd,
    taxProvisionUsd: yt?.taxProvisionUsd,
  })

  const valueSpread = roic != null && wacc != null ? roic - wacc : null

  const roiicErgebnis =
    ctx.roiic ?? berechneRoiicAusMacrotrendsZeilen(perioden, ebitZeile, roiZeile)
  const roiic = roiicErgebnis?.pct ?? null

  const roe =
    letzterWert(roeZeile, perioden) ??
    (ctx.yahoo?.returnOnEquity != null ? ctx.yahoo.returnOnEquity * 100 : null)

  const roa =
    letzterWert(roaZeile, perioden) ??
    (ctx.yahoo?.returnOnAssets != null ? ctx.yahoo.returnOnAssets * 100 : null)

  const netDebt =
    ctx.yahoo?.totalDebt != null && ctx.yahoo?.totalCash != null
      ? ctx.yahoo.totalDebt - ctx.yahoo.totalCash
      : null
  const netDebtEbitda =
    netDebt != null && ebitdaMio != null && ebitdaMio > 0 ? netDebt / (ebitdaMio * 1_000_000) : null

  const umsatzHist = historischeWerte(umsatzZeile, perioden)
  const epsHist = historischeWerte(epsZeile, perioden)
  const ebitdaHist = historischeWerte(ebitdaZeile, perioden)
  const ebitMargeHist = historischeWerte(ebitMargeZeile, perioden)
  const aktienHist = historischeWerte(aktienZeile, perioden)

  const umsatzCagr3 =
    umsatzHist.length >= 2 ? cagrProzent(umsatzHist.slice(-4), Math.min(3, umsatzHist.length - 1)) : null
  const epsCagr3 = epsHist.length >= 2 ? cagrProzent(epsHist.slice(-4), Math.min(3, epsHist.length - 1)) : null
  const ebitdaCagr3 =
    ebitdaHist.length >= 2 ? cagrProzent(ebitdaHist.slice(-4), Math.min(3, ebitdaHist.length - 1)) : null

  const revGrowthPct =
    ctx.yahoo?.revenueGrowth != null ? ctx.yahoo.revenueGrowth * 100 : umsatzCagr3

  const ruleOf40 =
    revGrowthPct != null && fcfMarge != null ? revGrowthPct + fcfMarge : null

  const assetTurnover = letzterWert(kapitalumschlagZeile, perioden)

  const payoutPct = ctx.yahoo?.payoutRatio != null ? ctx.yahoo.payoutRatio * 100 : null
  const pb = ctx.yahoo?.priceToBook ?? null

  const aktienSinkend =
    aktienHist.length >= 2 ? aktienHist[aktienHist.length - 1]! < aktienHist[0]! : null

  return {
    bruttoMarge,
    ebitMarge,
    ebitdaMarge,
    fcfMarge,
    capexSales,
    fcfConversion,
    roic,
    roicQuelle,
    wacc,
    valueSpread,
    roiic,
    roiicErgebnis,
    roe,
    roa,
    netDebt,
    netDebtEbitda,
    umsatzCagr3,
    epsCagr3,
    ebitdaCagr3,
    revGrowthPct,
    ruleOf40,
    assetTurnover,
    payoutPct,
    pb,
    aktienSinkend,
    ebitMargeHist,
    bruttoMargeHist: historischeWerte(bruttoMargeZeile, perioden),
    sbcAdjFcfMargin,
    sbcFcfRatio,
    sbcAdjFcfConversion,
    interestCoverage,
    interestUsd,
    rdSales,
    sgaSales,
    dsoHist,
    dsoAktuell,
  }
}

export type FundamentalKontextWerte = ReturnType<typeof baueKontextWerte>

import { cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  historischeWerteAusZeile,
  letzterVerfuegbarerWert,
  schaetzeWaccPct,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  berechneBruttomargenStabilitaet,
} from '@/lib/portfolio-analyse/fundamentaldaten-pricing-power'
import { berechneEarningsQuality } from '@/lib/portfolio-analyse/fundamentaldaten-earnings-quality'
import {
  berechnePegRatio,
  berechneReinvestition,
} from '@/lib/portfolio-analyse/fundamentaldaten-reinvestition'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import type { MantraYahooFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'
import type { UnitEconomicsTreffer } from '@/lib/portfolio-analyse/unit-economics-extraktion'

function mnaMioAusYahoo(yf: MantraYahooFinanzdaten | null | undefined): number | null {
  const hist = yf?.annualHistorie
  if (!hist?.length) return null
  for (let i = hist.length - 1; i >= 0; i--) {
    const raw = hist[i]?.purchaseOfBusinessUsd
    if (raw != null && Number.isFinite(raw) && Math.abs(raw) >= 1) {
      return Math.round((Math.abs(raw) / 1_000_000) * 10) / 10
    }
  }
  return null
}

function daMioAusYahoo(yf: MantraYahooFinanzdaten | null | undefined): number | null {
  const hist = yf?.annualHistorie
  if (!hist?.length) return null
  for (let i = hist.length - 1; i >= 0; i--) {
    const raw = hist[i]?.depreciationAmortizationUsd
    if (raw != null && Number.isFinite(raw) && Math.abs(raw) >= 1) {
      return Math.round((Math.abs(raw) / 1_000_000) * 10) / 10
    }
  }
  return null
}

/** ROIC ex Goodwill aus Yahoo-Jahresabschluss (wenn Macrotrends-Zeile fehlt). */
function roicExGoodwillAusYahoo(yf: MantraYahooFinanzdaten | null | undefined): number | null {
  const hist = yf?.annualHistorie
  if (!hist?.length) return null
  for (let i = hist.length - 1; i >= 0; i--) {
    const s = hist[i]!
    if (s.operatingIncomeUsd == null || s.stockholdersEquityUsd == null) continue
    const tax = 0.21
    if (s.pretaxIncomeUsd != null && s.pretaxIncomeUsd > 0 && s.taxProvisionUsd != null && s.taxProvisionUsd >= 0) {
      // effektiver Satz grob
    }
    const t =
      s.pretaxIncomeUsd != null && s.pretaxIncomeUsd > 0 && s.taxProvisionUsd != null && s.taxProvisionUsd >= 0
        ? Math.min(0.5, Math.max(0, s.taxProvisionUsd / s.pretaxIncomeUsd))
        : tax
    const nopat = s.operatingIncomeUsd * (1 - t)
    const ic =
      s.stockholdersEquityUsd + (s.totalDebtUsd ?? 0) - (s.cashAndEquivalentsUsd ?? 0)
    const gw = s.goodwillUsd ?? 0
    const denom = gw > 0 ? ic - gw : ic
    if (denom <= 0) continue
    const pct = (nopat / denom) * 100
    if (!Number.isFinite(pct) || Math.abs(pct) > 800) continue
    return Math.round(pct * 10) / 10
  }
  return null
}

export type FundamentalKontextInput = {
  yahoo: YahooFundamentalKennzahlen | null
  roh: Pick<MacrotrendsFundamentalRoh, 'perioden' | 'zeilen'> | null
  schaetzungen: FundamentalSchaetzungenRoh
  yahooFinanz: MantraYahooFinanzdaten | null
  /** LTV/CAC, NRR — aus SEC/Earnings Call extrahiert (falls genannt). */
  unitEconomics?: UnitEconomicsTreffer | null
  /** Vorberechnetes Incremental ROIC (Kapitalbasis, sonst Altquellen). */
  incrementalRoicPct?: number | null
  /**
   * Regime der ROIIC-Berechnung. Ohne diese Angabe ist der Wert nicht interpretierbar:
   * im kapitalleichten Regime ist der Nenner die Brutto-Reinvestition, nicht ΔIC.
   */
  incrementalRoicRegime?: 'normal' | 'kapitalleicht' | 'schrumpfend' | 'unzureichend' | null
  /** ROIIC inkl. akquiriertem Kapital — Kontrast zum organischen Wert. */
  incrementalRoicBuchPct?: number | null
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

/** Yahoo payoutRatio ist oft leer — Fallbacks aus GuV/Cashflow oder Div-Rendite × KGV. */
function berechneAusschuettungsquotePct(ctx: FundamentalKontextInput): number | null {
  const plausibel = (pct: number): number | null =>
    pct > 0 && pct < 500 ? Math.round(pct * 100) / 100 : null

  const yahooRatio = ctx.yahoo?.payoutRatio
  if (yahooRatio != null && Number.isFinite(yahooRatio) && yahooRatio > 0) {
    const pct = yahooRatio > 2 ? yahooRatio : yahooRatio * 100
    const hit = plausibel(pct)
    if (hit != null) return hit
  }

  const perioden = ctx.roh?.perioden
  const zeile = (id: string) => ctx.roh?.zeilen.find((z) => z.id === id)
  const divMio = letzterWert(zeile('dividenden_gezahlt'), perioden)
  const nettoMio = letzterWert(zeile('nettogewinn'), perioden)
  if (divMio != null && nettoMio != null && nettoMio > 0) {
    const hit = plausibel((Math.abs(divMio) / nettoMio) * 100)
    if (hit != null) return hit
  }

  const eps = letzterWert(zeile('eps'), perioden)
  const aktienMio = letzterWert(zeile('aktien'), perioden)
  if (divMio != null && eps != null && eps > 0 && aktienMio != null && aktienMio > 0) {
    const hit = plausibel((Math.abs(divMio) / aktienMio / eps) * 100)
    if (hit != null) return hit
  }

  const divRate = ctx.yahoo?.trailingAnnualDividendRate
  const trailEps = ctx.yahoo?.trailingEps
  if (divRate != null && trailEps != null && trailEps > 0) {
    const hit = plausibel((divRate / trailEps) * 100)
    if (hit != null) return hit
  }

  const divYield = ctx.yahoo?.dividendYield
  const pe = ctx.yahoo?.trailingPE
  if (divYield != null && pe != null && pe > 0 && divYield > 0) {
    const hit = plausibel(divYield * pe * 100)
    if (hit != null) return hit
  }

  return null
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
  const ocfZeile = zeile('ocf')
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
  const interestUsd =
    yt?.interestExpenseUsd ??
    (ctx.yahoo?.totalDebt != null && ctx.yahoo.totalDebt > 0
      ? ctx.yahoo.totalDebt * 0.045
      : null)
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
    fcfUsd != null && sbcUsd != null && Math.abs(fcfUsd) > 0
      ? (sbcUsd / Math.abs(fcfUsd)) * 100
      : null
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
  let roicExGoodwill = letzterWert(zeile('roi_ex_goodwill'), perioden)
  if (roicExGoodwill == null) {
    roicExGoodwill = roicExGoodwillAusYahoo(ctx.yahooFinanz) ?? (roic != null ? roic : null)
  }
  const roicAnzeige = roic ?? roicExGoodwill
  const roicQuelle =
    roic != null
      ? 'ROIC (Macrotrends/Bilanz)'
      : roicExGoodwill != null
        ? 'ROIC ex Goodwill'
        : undefined

  const wacc = schaetzeWaccPct({
    beta: ctx.yahoo?.beta,
    marketCapUsd: ctx.yahoo?.marketCap,
    totalDebtUsd: ctx.yahoo?.totalDebt,
    interestExpenseUsd: interestUsd,
    pretaxIncomeUsd: yt?.pretaxIncomeUsd,
    taxProvisionUsd: yt?.taxProvisionUsd,
  })

  const valueSpread = roicAnzeige != null && wacc != null ? roicAnzeige - wacc : null

  let roe = letzterWert(roeZeile, perioden)
  if (roe == null && ctx.yahoo?.returnOnEquity != null && Number.isFinite(ctx.yahoo.returnOnEquity)) {
    roe = Math.round(ctx.yahoo.returnOnEquity * 1000) / 10
  }

  let roa = letzterWert(roaZeile, perioden)
  if (roa == null && ctx.yahoo?.returnOnAssets != null && Number.isFinite(ctx.yahoo.returnOnAssets)) {
    roa = Math.round(ctx.yahoo.returnOnAssets * 1000) / 10
  }

  const bilanzDebtMio = letzterWert(zeile('gesamtverschuldung'), perioden)
  const bilanzCashMio = letzterWert(zeile('bargeld'), perioden)
  const bilanzNdMio = letzterWert(zeile('nettoverschuldung'), perioden)
  let netDebt: number | null = null
  if (bilanzNdMio != null) {
    netDebt = bilanzNdMio * 1_000_000
  } else if (bilanzDebtMio != null && bilanzCashMio != null) {
    netDebt = (bilanzDebtMio - bilanzCashMio) * 1_000_000
  } else if (ctx.yahoo?.totalDebt != null && ctx.yahoo?.totalCash != null) {
    netDebt = ctx.yahoo.totalDebt - ctx.yahoo.totalCash
  }
  const netDebtEbitda =
    netDebt != null && ebitdaMio != null && ebitdaMio > 0 ? netDebt / (ebitdaMio * 1_000_000) : null

  const fcfUsdAbs =
    fcfMio != null ? Math.abs(fcfMio) * 1_000_000 : fcfUsd != null ? Math.abs(fcfUsd) : null
  const netDebtFcf =
    netDebt != null && fcfUsdAbs != null && fcfUsdAbs > 0 ? netDebt / fcfUsdAbs : null

  const umsatzHist = historischeWerte(umsatzZeile, perioden)
  const epsHist = historischeWerte(epsZeile, perioden)
  const ebitdaHist = historischeWerte(ebitdaZeile, perioden)
  const ebitMargeHist = historischeWerte(ebitMargeZeile, perioden)
  const aktienHist = historischeWerte(aktienZeile, perioden)
  const roicHist = historischeWerte(roiZeile, perioden)
  const ebitHist = historischeWerte(ebitZeile, perioden)
  const sgaHist = historischeWerte(sgaZeile, perioden)

  const umsatzCagr3 =
    umsatzHist.length >= 2 ? cagrProzent(umsatzHist.slice(-4), Math.min(3, umsatzHist.length - 1)) : null
  const epsCagr3 = epsHist.length >= 2 ? cagrProzent(epsHist.slice(-4), Math.min(3, epsHist.length - 1)) : null
  const ebitdaCagr3 =
    ebitdaHist.length >= 2 ? cagrProzent(ebitdaHist.slice(-4), Math.min(3, ebitdaHist.length - 1)) : null

  const roiic = ctx.incrementalRoicPct ?? null

  const reinvest = perioden
    ? berechneReinvestition(
        perioden,
        ctx.roh?.zeilen ?? [],
        mnaMioAusYahoo(ctx.yahooFinanz),
        daMioAusYahoo(ctx.yahooFinanz),
        roiic,
      )
    : { reinvestitionsquotePct: null, incrementalRoicPct: roiic, bruttoReinvestMio: null }
  const eq = perioden
    ? berechneEarningsQuality(perioden, ctx.roh?.zeilen ?? [])
    : { sloanRatio: null, beneishMScore: null, beneishRisiko: null }

  const bruttoHist = historischeWerte(bruttoMargeZeile, perioden)
  const margeStab = berechneBruttomargenStabilitaet(bruttoHist)

  const fwdPe = ctx.yahoo?.forwardPE ?? ctx.yahoo?.trailingPE ?? null
  const epsWachstumPct =
    ctx.yahoo?.earningsGrowth != null ? ctx.yahoo.earningsGrowth * 100 : epsCagr3
  const pegRatio = berechnePegRatio(fwdPe, epsWachstumPct, null)

  const revGrowthPct =
    ctx.yahoo?.revenueGrowth != null ? ctx.yahoo.revenueGrowth * 100 : umsatzCagr3

  const ruleOf40 =
    revGrowthPct != null
      ? (() => {
          const marge = Math.max(
            fcfMarge ?? Number.NEGATIVE_INFINITY,
            ebitMarge ?? Number.NEGATIVE_INFINITY,
            ebitdaMarge ?? Number.NEGATIVE_INFINITY,
          )
          return Number.isFinite(marge) ? revGrowthPct + marge : null
        })()
      : null

  const assetTurnover = letzterWert(kapitalumschlagZeile, perioden)

  const payoutPct = berechneAusschuettungsquotePct(ctx)
  const divYieldPct =
    ctx.yahoo?.dividendYield != null && ctx.yahoo.dividendYield > 0
      ? Math.round(ctx.yahoo.dividendYield * 1000) / 10
      : ctx.yahoo?.trailingAnnualDividendRate != null &&
          ctx.yahoo?.currentPrice != null &&
          ctx.yahoo.currentPrice > 0
        ? Math.round((ctx.yahoo.trailingAnnualDividendRate / ctx.yahoo.currentPrice) * 1000) / 10
        : payoutPct != null && fwdPe != null && fwdPe > 0
          ? Math.round((payoutPct / fwdPe) * 1000) / 10
          : null
  const pb = ctx.yahoo?.priceToBook ?? null

  const aktienSinkend =
    aktienHist.length >= 2 ? aktienHist[aktienHist.length - 1]! < aktienHist[0]! : null

  /** Junge/Wachstumsfirma: niedrige Profitabilität bei hohem Wachstum. */
  const istWachstumsfirma =
    (ebitMarge != null && ebitMarge < 15) ||
    (nettoMio != null && nettoMio < 0) ||
    (fcfMarge != null && fcfMarge < 10 && revGrowthPct != null && revGrowthPct > 12)

  const roicSteigend =
    roicHist.length >= 3 && roicHist[roicHist.length - 1]! > roicHist[0]! + 2
  const roicKonstantHoch =
    roicHist.length >= 5 && roicHist.filter((r) => r >= 15).length >= Math.ceil(roicHist.length * 0.7)

  let inkrementelleOpMarge: number | null = null
  if (ebitHist.length >= 2 && umsatzHist.length >= 2) {
    const n = Math.min(ebitHist.length, umsatzHist.length)
    const e0 = ebitHist[n - 2]!
    const e1 = ebitHist[n - 1]!
    const u0 = umsatzHist[n - 2]!
    const u1 = umsatzHist[n - 1]!
    const deltaU = u1 - u0
    if (deltaU > 0) inkrementelleOpMarge = ((e1 - e0) / deltaU) * 100
  }

  const sgaRatioHist: number[] = []
  for (let i = 0; i < Math.min(sgaHist.length, umsatzHist.length); i++) {
    const u = umsatzHist[i]!
    const s = sgaHist[i]!
    if (u > 0 && s >= 0) sgaRatioHist.push((s / u) * 100)
  }
  const sgaDegressiv =
    sgaRatioHist.length >= 3 && sgaRatioHist[sgaRatioHist.length - 1]! < sgaRatioHist[0]! - 0.5

  let aktienVerwaesserungJaehrlichPct: number | null = null
  if (aktienHist.length >= 2) {
    const a0 = aktienHist[0]!
    const a1 = aktienHist[aktienHist.length - 1]!
    const jahre = aktienHist.length - 1
    if (a0 > 0 && jahre > 0) {
      aktienVerwaesserungJaehrlichPct = (Math.pow(a1 / a0, 1 / jahre) - 1) * 100
    }
  }

  return {
    bruttoMarge,
    ebitMarge,
    ebitdaMarge,
    fcfMarge,
    capexSales,
    fcfConversion,
    roic,
    roicAnzeige,
    roicExGoodwill,
    roicQuelle,
    wacc,
    valueSpread,
    roe,
    roa,
    netDebt,
    netDebtEbitda,
    netDebtFcf,
    reinvestitionsquotePct: reinvest.reinvestitionsquotePct,
    incrementalRoicPct: reinvest.incrementalRoicPct,
    incrementalRoicRegime: ctx.incrementalRoicRegime ?? null,
    incrementalRoicBuchPct: ctx.incrementalRoicBuchPct ?? null,
    pegRatio,
    sloanRatio: eq.sloanRatio,
    beneishMScore: eq.beneishMScore,
    beneishRisiko: eq.beneishRisiko,
    umsatzCagr3,
    epsCagr3,
    ebitdaCagr3,
    revGrowthPct,
    ruleOf40,
    assetTurnover,
    payoutPct,
    divYieldPct,
    pb,
    aktienSinkend,
    roicHist,
    roicSteigend,
    roicKonstantHoch,
    istWachstumsfirma,
    inkrementelleOpMarge,
    sgaRatioHist,
    sgaDegressiv,
    aktienVerwaesserungJaehrlichPct,
    ebitMargeHist,
    bruttoMargeHist: bruttoHist,
    bruttoMargeStd10y: margeStab.bruttoMargeStd10y,
    bruttoMargeJahre: margeStab.bruttoMargeJahre,
    pricingPowerOk: margeStab.pricingPowerOk,
    sbcAdjFcfMargin,
    sbcFcfRatio,
    sbcAdjFcfConversion,
    interestCoverage,
    interestUsd,
    rdSales,
    sgaSales,
    dsoHist,
    dsoAktuell,
    ltvCac: ctx.unitEconomics?.ltvCac ?? null,
    nrrPct: ctx.unitEconomics?.nrrPct ?? null,
    grossRetentionPct: ctx.unitEconomics?.grossRetentionPct ?? null,
    ltvCacQuelle: ctx.unitEconomics?.quelle ?? null,
    ltvCacPeriode: ctx.unitEconomics?.periode ?? null,
    ltvCacHinweis: ctx.unitEconomics?.hinweis ?? null,
    ltvCacSnippet: ctx.unitEconomics?.snippet ?? null,
  }
}

export type FundamentalKontextWerte = ReturnType<typeof baueKontextWerte>

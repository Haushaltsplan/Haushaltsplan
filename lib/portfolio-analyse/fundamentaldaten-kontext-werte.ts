import { cagr3AusSerie, cagr5AusSerie, cagrJaehrlichAusSerie, mittelLetzteJahresSnapshots, werteOhneNiveauSprung } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  historischeWerteAusZeile,
  istQuartalsPerioden,
  letzterVerfuegbarerWert,
  berechneIncrementalValueSpread,
  schaetzeWaccPct,
  ttmOderLetzterFlow,
  werteGleicherStichtag,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import {
  berechneBruttomargenStabilitaet,
  istScheinBruttomargeSerie,
} from '@/lib/portfolio-analyse/fundamentaldaten-pricing-power'
import { berechneEarningsQuality } from '@/lib/portfolio-analyse/fundamentaldaten-earnings-quality'
import {
  berechnePegRatio,
  berechneReinvestition,
} from '@/lib/portfolio-analyse/fundamentaldaten-reinvestition'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import type { MantraYahooFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'
import type { UnitEconomicsTreffer } from '@/lib/portfolio-analyse/unit-economics-extraktion'
import { erkenneKapitalProfil } from '@/lib/portfolio-analyse/kapital-profil'

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
    const ic = s.stockholdersEquityUsd + (s.totalDebtUsd ?? 0)
    const gw = s.goodwillUsd ?? 0
    const denom = gw > 0 ? ic - gw : ic
    if (denom <= 0) continue
    if (gw > 0 && ic > 0 && gw >= ic * 0.85) continue
    const pct = (nopat / denom) * 100
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) continue
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
  /** Sektor/Branche für Kapital-Profil (keine Ticker-Logik). */
  sektor?: string | null
  branche?: string | null
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

function mittelLetzte(werte: number[], n = 5, min = 3): number | null {
  const xs = werte.filter((v) => Number.isFinite(v)).slice(-n)
  if (xs.length < min) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function quotientSerie(
  zaehler: FundamentalMetrikZeile | undefined,
  nenner: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number[] {
  const keys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  const out: number[] = []
  for (const k of keys) {
    const z = zaehler?.werte[k]
    const n = nenner?.werte[k]
    if (z != null && n != null && n > 0 && Number.isFinite(z) && Number.isFinite(n)) out.push(z / n)
  }
  return out
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
  const quartal = istQuartalsPerioden(perioden)
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

  // Flows: auf Quartalspaket TTM (Summe 4Q), sonst letzter/TTM-Wert
  const umsatzMio = ttmOderLetzterFlow(umsatzZeile, perioden)
  const fcfMio = ttmOderLetzterFlow(fcfZeile, perioden)
  const nettoMio = ttmOderLetzterFlow(nettoZeile, perioden)
  const capexMio = ttmOderLetzterFlow(capexZeile, perioden)
  const ebitdaMio = ttmOderLetzterFlow(ebitdaZeile, perioden)
  const ebitMio = ttmOderLetzterFlow(ebitZeile, perioden)

  const revenueUsd = yt?.revenueUsd ?? (umsatzMio != null ? umsatzMio * 1_000_000 : null)
  const fcfUsd = yt?.freeCashFlowUsd ?? (fcfMio != null ? fcfMio * 1_000_000 : null)
  const netIncomeUsd = yt?.netIncomeUsd ?? (nettoMio != null ? nettoMio * 1_000_000 : null)
  const sbcUsd =
    yt?.stockBasedCompensationUsd ??
    (() => {
      const v = ttmOderLetzterFlow(sbcZeile, perioden)
      return v != null ? v * 1_000_000 : null
    })()
  const interestUsd =
    yt?.interestExpenseUsd ??
    (ctx.yahoo?.totalDebt != null && ctx.yahoo.totalDebt > 0
      ? ctx.yahoo.totalDebt * 0.045
      : null)
  const opIncomeUsd = yt?.operatingIncomeUsd ?? (ebitMio != null ? ebitMio * 1_000_000 : null)
  const rdUsd =
    yt?.researchDevelopmentUsd ??
    (() => {
      const v = ttmOderLetzterFlow(rdZeile, perioden)
      return v != null ? v * 1_000_000 : null
    })()
  const sgaUsd =
    yt?.sgaUsd ??
    (() => {
      const v = ttmOderLetzterFlow(sgaZeile, perioden)
      return v != null ? v * 1_000_000 : null
    })()

  const sbcAdjFcfUsd = fcfUsd != null && sbcUsd != null ? fcfUsd - sbcUsd : null

  const bruttoMargeRoh =
    letzterWert(bruttoMargeZeile, perioden) ??
    berechneMargePct(letzterWert(bruttoGewinnZeile, perioden), umsatzMio) ??
    (ctx.yahoo?.grossMargins != null ? ctx.yahoo.grossMargins * 100 : null)

  const bruttoHistRoh = historischeWerte(bruttoMargeZeile, perioden)
  // Macrotrends setzt bei Payment-Networks oft Bruttogewinn = Umsatz → 100 % Schein-Marge
  const scheinBrutto =
    istScheinBruttomargeSerie(bruttoHistRoh) ||
    (bruttoMargeRoh != null &&
      bruttoMargeRoh >= 99.5 &&
      letzterWert(bruttoGewinnZeile, perioden) != null &&
      umsatzMio != null &&
      Math.abs(letzterWert(bruttoGewinnZeile, perioden)! - umsatzMio) / umsatzMio < 0.005)
  const bruttoMarge = scheinBrutto ? null : bruttoMargeRoh

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
  const ocfMio = ttmOderLetzterFlow(ocfZeile, perioden)
  const ocfUsd = yt?.operatingCashFlowUsd ?? (ocfMio != null ? ocfMio * 1_000_000 : null)
  const sbcOcfRatio =
    ocfUsd != null && sbcUsd != null && Math.abs(ocfUsd) > 0
      ? (Math.abs(sbcUsd) / Math.abs(ocfUsd)) * 100
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
  const fcfNiPaar = werteGleicherStichtag(fcfZeile, nettoZeile, perioden)
  const fcfConversion =
    fcfNiPaar != null
      ? (fcfNiPaar.zaehler / fcfNiPaar.nenner) * 100
      : nettoMio != null && fcfMio != null && nettoMio > 0
        ? (fcfMio / nettoMio) * 100
        : yt?.freeCashFlowUsd != null && yt?.netIncomeUsd != null && yt.netIncomeUsd > 0
          ? (yt.freeCashFlowUsd / yt.netIncomeUsd) * 100
          : null

  const roic = letzterWert(roiZeile, perioden)
  const hatGoodwillZeile =
    (historischeWerte(zeile('goodwill'), perioden).filter((v) => v > 0).length >= 1) ||
    (letzterWert(zeile('goodwill'), perioden) != null && (letzterWert(zeile('goodwill'), perioden) ?? 0) > 0)

  let roicExGoodwill = letzterWert(zeile('roi_ex_goodwill'), perioden)
  if (roicExGoodwill != null && (roicExGoodwill <= 0 || roicExGoodwill > 100)) {
    roicExGoodwill = null
  }
  if (roicExGoodwill == null && !hatGoodwillZeile) {
    // Nur ohne Goodwill: Yahoo/Spiegel erlauben
    roicExGoodwill = roicExGoodwillAusYahoo(ctx.yahooFinanz) ?? (roic != null ? roic : null)
  } else if (roicExGoodwill == null) {
    // Mit Goodwill: Yahoo nur wenn Quotient sinnvoll (Filter in Helfer)
    roicExGoodwill = roicExGoodwillAusYahoo(ctx.yahooFinanz)
  }
  // Nie ex-GW als Haupt-ROIC verwenden, wenn Macrotrends/Bilanz-ROIC fehlt und ex-GW Artefakt wäre
  const roicAnzeige = roic ?? (!hatGoodwillZeile ? roicExGoodwill : null)
  const roicQuelle =
    roic != null
      ? 'ROIC (Macrotrends/Bilanz)'
      : roicAnzeige != null
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
  const netDebtEbitdaZeile = zeile('net_debt_ebitda')
  const netDebtEbitdaAusZeile = letzterWert(netDebtEbitdaZeile, perioden)
  const netDebtEbitda =
    netDebtEbitdaAusZeile ??
    (netDebt != null && ebitdaMio != null && ebitdaMio > 0
      ? netDebt / (ebitdaMio * 1_000_000)
      : null)

  const fcfUsdAbs =
    fcfMio != null ? Math.abs(fcfMio) * 1_000_000 : fcfUsd != null ? Math.abs(fcfUsd) : null
  const netDebtFcf =
    netDebt != null && fcfUsdAbs != null && fcfUsdAbs > 0 ? netDebt / fcfUsdAbs : null

  const qOpts = quartal ? { quartal: true as const } : undefined
  const umsatzHist = historischeWerte(umsatzZeile, perioden)
  const epsHist = historischeWerte(epsZeile, perioden)
  const ebitdaHist = historischeWerte(ebitdaZeile, perioden)
  const ebitMargeHist = historischeWerte(ebitMargeZeile, perioden)
  const aktienHist = historischeWerte(aktienZeile, perioden)
  const roicHist = historischeWerte(roiZeile, perioden)
  const ebitHist = historischeWerte(ebitZeile, perioden)
  const sgaHist = historischeWerte(sgaZeile, perioden)

  const umsatzCagr3 = cagr3AusSerie(umsatzHist, qOpts)
  const umsatzCagr5 = cagr5AusSerie(umsatzHist, qOpts)
  const epsCagr3 = cagr3AusSerie(epsHist, qOpts)
  const epsCagr5 = cagr5AusSerie(epsHist, qOpts)
  const ebitdaCagr3 = cagr3AusSerie(ebitdaHist, qOpts)
  const fcfJeAktieHist = quotientSerie(fcfZeile, aktienZeile, perioden)
  const fcfJeAktieCagr5 = cagr5AusSerie(fcfJeAktieHist, qOpts)
  const roic5yAvgPct = quartal
    ? mittelLetzteJahresSnapshots(roicHist, 5, 3)
    : mittelLetzte(roicHist, 5, 3)

  const roiic = ctx.incrementalRoicPct ?? null
  const incrementalValueSpread = berechneIncrementalValueSpread({
    incrementalRoicPct: roiic,
    wacc,
    roicAnzeige,
    valueSpread,
  })

  // Quartal: kein FY-M&A in die Reinvestitionsquote mischen
  const reinvest = perioden
    ? berechneReinvestition(
        perioden,
        ctx.roh?.zeilen ?? [],
        quartal ? null : mnaMioAusYahoo(ctx.yahooFinanz),
        quartal ? null : daMioAusYahoo(ctx.yahooFinanz),
        roiic,
      )
    : { reinvestitionsquotePct: null, incrementalRoicPct: roiic, bruttoReinvestMio: null }
  const eq = perioden
    ? berechneEarningsQuality(perioden, ctx.roh?.zeilen ?? [])
    : { sloanRatio: null, beneishMScore: null, beneishRisiko: null }

  const bruttoHist = scheinBrutto ? [] : bruttoHistRoh
  const margeStab = berechneBruttomargenStabilitaet(bruttoHistRoh)

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
  const yahooYld = ctx.yahoo?.dividendYield
  const yahooYldPct =
    yahooYld != null && yahooYld > 0
      ? yahooYld < 0.2
        ? yahooYld * 100
        : yahooYld
      : null
  const kursYldPct =
    ctx.yahoo?.trailingAnnualDividendRate != null &&
    ctx.yahoo?.currentPrice != null &&
    ctx.yahoo.currentPrice > 0
      ? (ctx.yahoo.trailingAnnualDividendRate / ctx.yahoo.currentPrice) * 100
      : null
  const payoutYldPct =
    payoutPct != null && fwdPe != null && fwdPe > 0 ? payoutPct / fwdPe : null
  const divYieldRoh = yahooYldPct ?? kursYldPct ?? payoutYldPct
  const divYieldPct =
    divYieldRoh != null && Number.isFinite(divYieldRoh) && divYieldRoh > 0 && divYieldRoh <= 15
      ? Math.round(divYieldRoh * 10) / 10
      : null
  const pb = ctx.yahoo?.priceToBook ?? null

  const aktienVerwaesserungJaehrlichPct = cagrJaehrlichAusSerie(aktienHist, 5, 1.85, qOpts)
  const aktienFuerTrend = werteOhneNiveauSprung(aktienHist, 1.85)
  const aktienSinkend =
    aktienFuerTrend.length >= 2
      ? aktienFuerTrend[aktienFuerTrend.length - 1]! < aktienFuerTrend[0]!
      : null

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

  const eigenkapitalMio = letzterWert(zeile('eigenkapital'), perioden)
  let stockholdersEquityUsd: number | null = null
  const hist = ctx.yahooFinanz?.annualHistorie
  if (hist?.length) {
    for (let i = hist.length - 1; i >= 0; i--) {
      const eq = hist[i]?.stockholdersEquityUsd
      if (eq != null && Number.isFinite(eq)) {
        stockholdersEquityUsd = eq
        break
      }
    }
  }
  if (stockholdersEquityUsd == null && eigenkapitalMio != null) {
    stockholdersEquityUsd = eigenkapitalMio * 1_000_000
  }

  const industrie =
    (ctx.yahoo && 'industry' in ctx.yahoo && typeof ctx.yahoo.industry === 'string'
      ? ctx.yahoo.industry
      : null) ??
    ctx.branche ??
    null
  const sektor = ctx.sektor ?? (ctx.yahoo && 'sector' in ctx.yahoo && typeof ctx.yahoo.sector === 'string'
    ? ctx.yahoo.sector
    : null)

  const kapitalProfilErkennung = erkenneKapitalProfil({
    stockholdersEquityUsd,
    roePct: roe,
    roicPct: roicAnzeige,
    fcfConversionPct: fcfConversion,
    fcfMargePct: fcfMarge,
    capexSalesPct: capexSales,
    assetTurnover,
    nrrPct: ctx.unitEconomics?.nrrPct ?? null,
    bruttoMargePct: bruttoMarge,
    revGrowthPct,
    sbcFcfRatio,
    aktienSinkend,
    incrementalRoicRegime: ctx.incrementalRoicRegime ?? null,
    interestCoverage,
    netDebtEbitda,
    industrie,
    sektor,
    branche: ctx.branche ?? null,
    istWachstumsfirma,
  })

  return {
    bruttoMarge,
    bruttoMargeSchein: scheinBrutto,
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
    incrementalValueSpread,
    roic5yAvgPct,
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
    umsatzCagr5,
    epsCagr3,
    epsCagr5,
    ebitdaCagr3,
    fcfJeAktieCagr5,
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
    sbcOcfRatio,
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
    stockholdersEquityUsd,
    industrie,
    sektor,
    branche: ctx.branche ?? null,
    kapitalProfil: kapitalProfilErkennung.profil,
    kapitalProfilErkennung,
  }
}

export type FundamentalKontextWerte = ReturnType<typeof baueKontextWerte>

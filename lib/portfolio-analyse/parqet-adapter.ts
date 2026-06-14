import { ParqetCoreAnalyticsEngine } from '@/lib/portfolio-analyse/parqet-core'
import {
  baueMonatsVerlauf,
  irrAusBuchungen,
  realisierterGewinnAusVerkaeufen,
  steuernAufDividendenMonate,
  summenAusBuchungen,
  twrAusMonatsVerlauf,
} from '@/lib/portfolio-analyse/depot-berechnung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type {
  AssetCashflow,
  AssetHolding,
  EtfBreakdown,
  ParqetAssetType,
  PortfolioData,
  SinglePortfolioReport,
} from '@/lib/portfolio-analyse/parqet-core/types'
import { isinSektorName } from '@/lib/portfolio-analyse/isin-sektoren'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { AssetKlasse, PortfolioBuchung, PortfolioDbBuchung } from '@/lib/portfolio-analyse/types'

const PORTFOLIO_CASH_ID = '__portfolio_cash__'

function assetTyp(klasse: AssetKlasse): ParqetAssetType {
  switch (klasse) {
    case 'aktie':
      return 'Aktie'
    case 'etf':
      return 'ETF'
    case 'crypto':
      return 'Krypto'
    default:
      return 'Sachwert'
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Baut Parqet-Engine-Eingang aus Buchungen und Live-Positionen. */
export function portfolioDataAusBuchungen(
  buchungen: PortfolioDbBuchung[],
  positionen: LivePosition[],
  depotwertEur = 0,
  cashEur = 0,
  opts?: {
    etfBreakdowns?: Map<string, EtfBreakdown>
    meta?: Map<string, IsinMetadata>
  },
): PortfolioData {
  const byIsin = new Map<string, AssetHolding>()
  const einstandMap = new Map<string, { stueck: number; kosten: number }>()

  for (const p of positionen) {
    const id = p.isin?.toUpperCase() ?? p.anzeigeName
    const isin = p.isin?.trim().toUpperCase()
    const m = isin ? opts?.meta?.get(isin) : undefined
    const yahooSymbol = m?.symbolYahoo ?? m?.symbolCandidates?.[0] ?? undefined
    const stk = p.stueck
    const avg = stk > 0 ? p.einstandEur / stk : 0
    const cur = stk > 0 ? p.wertLiveEur / stk : avg
    byIsin.set(id, {
      assetId: id,
      assetName: p.anzeigeName,
      assetType: assetTyp(p.assetKlasse),
      sectorName: isinSektorName(p.isin),
      yahooSymbol,
      etfBreakdown: isin && p.assetKlasse === 'etf' ? opts?.etfBreakdowns?.get(isin) : undefined,
      quantity: stk,
      averagePrice: round2(avg),
      currentPrice: round2(cur),
      totalDividendsGross: 0,
      totalDividendsNet: 0,
      realizedGainsEUR: 0,
      totalFeesEUR: 0,
      totalTaxesEUR: 0,
      cashflows: [],
    })
  }

  const portfolioCash: AssetHolding = {
    assetId: PORTFOLIO_CASH_ID,
    assetName: 'Depot (Cash)',
    assetType: 'Cash',
    quantity: 1,
    averagePrice: cashEur,
    currentPrice: cashEur,
    totalDividendsGross: 0,
    totalDividendsNet: 0,
    realizedGainsEUR: 0,
    totalFeesEUR: 0,
    totalTaxesEUR: 0,
    cashflows: [],
  }

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))

  for (const b of sortiert) {
    const ts = new Date(`${b.datum}T12:00:00`)
    if (!Number.isFinite(ts.getTime())) continue

    if (b.typ === 'einzahlung' || b.typ === 'auszahlung') {
      portfolioCash.cashflows.push({
        timestamp: ts,
        amountEUR: b.betragEur,
        type: b.typ === 'einzahlung' ? 'OUT' : 'IN',
      })
      continue
    }

    const isin = b.isin?.toUpperCase()
    if (!isin) {
      if (b.typ === 'steuer') portfolioCash.totalTaxesEUR += b.betragEur
      if (b.typ === 'gebuehr') portfolioCash.totalFeesEUR += b.betragEur
      continue
    }

    let holding = byIsin.get(isin)
    if (!holding) {
      holding = {
        assetId: isin,
        assetName: b.wertpapierName ?? isin,
        assetType: assetTyp(b.assetKlasse),
        sectorName: isinSektorName(isin),
        quantity: 0,
        averagePrice: 0,
        currentPrice: 0,
        totalDividendsGross: 0,
        totalDividendsNet: 0,
        realizedGainsEUR: 0,
        totalFeesEUR: 0,
        totalTaxesEUR: 0,
        cashflows: [],
      }
      byIsin.set(isin, holding)
    }

    if (b.typ === 'dividende' || b.typ === 'zins') {
      holding.totalDividendsGross += b.betragEur
      holding.totalDividendsNet += b.betragEur
      holding.cashflows.push({ timestamp: ts, amountEUR: b.betragEur, type: 'DIVIDEND' })
    } else if (b.typ === 'steuer') {
      holding.totalTaxesEUR += b.betragEur
    } else if (b.typ === 'gebuehr') {
      holding.totalFeesEUR += b.betragEur
    } else if (b.typ === 'kauf') {
      let stkKauf = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stkKauf <= 0 && b.kursEur != null && b.kursEur > 0) stkKauf = b.betragEur / b.kursEur
      if (stkKauf > 0) {
        const cur = einstandMap.get(isin) ?? { stueck: 0, kosten: 0 }
        cur.stueck += stkKauf
        cur.kosten += b.betragEur
        einstandMap.set(isin, cur)
      }
      holding.cashflows.push({ timestamp: ts, amountEUR: b.betragEur, type: 'OUT' })
    } else if (b.typ === 'verkauf') {
      const einstand = einstandMap.get(isin)
      let stkVerk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stkVerk <= 0 && b.kursEur != null && b.kursEur > 0) stkVerk = b.betragEur / b.kursEur
      if (einstand && einstand.stueck > 0 && stkVerk > 0) {
        const anteil = Math.min(1, stkVerk / einstand.stueck)
        const kostenAnteil = einstand.kosten * anteil
        holding.realizedGainsEUR += round2(b.betragEur - kostenAnteil)
        einstand.kosten = round2(einstand.kosten * (1 - anteil))
        einstand.stueck = Math.max(0, einstand.stueck - stkVerk)
      }
      holding.cashflows.push({ timestamp: ts, amountEUR: b.betragEur, type: 'IN' })
    }
  }

  const assets = [...byIsin.values()].filter((a) => a.quantity > 0 || a.cashflows.length > 0)
  if (portfolioCash.cashflows.length > 0 || cashEur > 0) {
    assets.push(portfolioCash)
  }

  return {
    portfolios: [
      {
        portfolioId: 'depot',
        portfolioName: 'Depot',
        type: 'Standard',
        assets,
      },
    ],
    taxFreeAmountRemainingEUR: 0,
  }
}

export function parqetReportAusDepot(
  buchungen: PortfolioDbBuchung[],
  positionen: LivePosition[],
  depotwertEur?: number,
  cashEur = 0,
  opts?: {
    etfBreakdowns?: Map<string, EtfBreakdown>
    meta?: Map<string, IsinMetadata>
  },
): SinglePortfolioReport {
  const terminal = depotwertEur ?? positionen.reduce((s, p) => s + p.wertLiveEur, 0) + cashEur
  const data = portfolioDataAusBuchungen(buchungen, positionen, terminal, cashEur, opts)
  const engine = new ParqetCoreAnalyticsEngine(data)
  const report = engine.generateUltimateReport().consolidated

  const irr = irrAusBuchungen(buchungen, terminal)
  if (irr != null) {
    report.performance.irrAnnualizedPercent = irr
  }

  const verlauf = baueMonatsVerlauf(buchungen, terminal)
  const twr = twrAusMonatsVerlauf(verlauf, buchungen)
  if (twr != null) {
    report.performance.twrTotalPercent = twr
  }

  const summen = summenAusBuchungen(buchungen)
  const bruttoDiv = summen.dividenden + summen.zinsen
  const steuerDiv = steuernAufDividendenMonate(buchungen)
  report.metrics.totalDividendsGrossEUR = bruttoDiv
  report.metrics.totalDividendsNetEUR = round2(Math.max(0, bruttoDiv - steuerDiv))
  report.metrics.totalTaxesEUR = summen.steuern
  report.metrics.totalFeesEUR = summen.gebuehren
  report.taxFees.totalTaxesPaidEUR = summen.steuern
  report.taxFees.totalFeesPaidEUR = summen.gebuehren

  const realisiert = realisierterGewinnAusVerkaeufen(buchungen)
  report.metrics.realizedGainsEUR = realisiert
  report.taxFees.realizedGainsEUR = realisiert

  return report
}

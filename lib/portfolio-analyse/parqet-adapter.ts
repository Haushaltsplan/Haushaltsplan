import { ParqetCoreAnalyticsEngine } from '@/lib/portfolio-analyse/parqet-core'
import type {
  AssetCashflow,
  AssetHolding,
  ParqetAssetType,
  PortfolioData,
  SinglePortfolioReport,
} from '@/lib/portfolio-analyse/parqet-core/types'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { AssetKlasse, PortfolioBuchung, PortfolioDbBuchung } from '@/lib/portfolio-analyse/types'

function assetTyp(klasse: AssetKlasse): ParqetAssetType {
  switch (klasse) {
    case 'aktie':
      return 'Aktie'
    case 'etf':
      return 'ETF'
    case 'crypto':
      return 'Krypto'
    case 'geldmarkt':
    case 'anleihe':
    case 'sonstiges':
    default:
      return 'Sachwert'
  }
}

function cashflowTyp(typ: PortfolioBuchung['typ']): AssetCashflow['type'] | null {
  switch (typ) {
    case 'kauf':
      return 'OUT'
    case 'verkauf':
      return 'IN'
    case 'dividende':
    case 'zins':
      return 'DIVIDEND'
    default:
      return null
  }
}

/** Baut Parqet-Engine-Eingang aus Buchungen und Live-Positionen. */
export function portfolioDataAusBuchungen(
  buchungen: PortfolioDbBuchung[],
  positionen: LivePosition[],
): PortfolioData {
  const byIsin = new Map<string, AssetHolding>()

  for (const p of positionen) {
    const id = p.isin?.toUpperCase() ?? p.anzeigeName
    const stk = p.stueck
    const avg = stk > 0 ? p.einstandEur / stk : 0
    const cur = stk > 0 ? p.wertLiveEur / stk : avg
    byIsin.set(id, {
      assetId: id,
      assetName: p.anzeigeName,
      assetType: assetTyp(p.assetKlasse),
      quantity: stk,
      averagePrice: Math.round(avg * 10000) / 10000,
      currentPrice: Math.round(cur * 10000) / 10000,
      totalDividendsGross: 0,
      totalDividendsNet: 0,
      realizedGainsEUR: 0,
      totalFeesEUR: 0,
      totalTaxesEUR: 0,
      cashflows: [],
    })
  }

  for (const b of buchungen) {
    const isin = b.isin?.toUpperCase()
    if (!isin) continue
    const cfTyp = cashflowTyp(b.typ)
    if (!cfTyp) continue

    let holding = byIsin.get(isin)
    if (!holding) {
      holding = {
        assetId: isin,
        assetName: b.wertpapierName ?? isin,
        assetType: assetTyp(b.assetKlasse),
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

    const ts = new Date(`${b.datum}T12:00:00`)
    if (cfTyp === 'DIVIDEND') {
      holding.totalDividendsGross += b.betragEur
      holding.totalDividendsNet += b.betragEur
    }
    if (b.typ === 'steuer') holding.totalTaxesEUR += b.betragEur
    if (b.typ === 'gebuehr') holding.totalFeesEUR += b.betragEur

    holding.cashflows.push({
      timestamp: ts,
      amountEUR: b.betragEur,
      type: cfTyp,
    })
  }

  return {
    portfolios: [
      {
        portfolioId: 'depot',
        portfolioName: 'Depot',
        type: 'Standard',
        assets: [...byIsin.values()].filter((a) => a.quantity > 0 || a.cashflows.length > 0),
      },
    ],
    taxFreeAmountRemainingEUR: 0,
  }
}

export function parqetReportAusDepot(
  buchungen: PortfolioDbBuchung[],
  positionen: LivePosition[],
): SinglePortfolioReport {
  const data = portfolioDataAusBuchungen(buchungen, positionen)
  const engine = new ParqetCoreAnalyticsEngine(data)
  return engine.generateUltimateReport().consolidated
}

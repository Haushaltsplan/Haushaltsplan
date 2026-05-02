import { DEFAULT_PORTFOLIO_POSITIONEN } from '@/lib/investment-portfolio-data'
import type { PortfolioPositionMitNotiz } from '@/lib/investment-portfolio-types'

/** Gleiche IDs wie der Server-Store — für „Standardliste wiederherstellen“ in der Client-UI. */
export function portfolioStandardZeilenMitMeta(): PortfolioPositionMitNotiz[] {
  return DEFAULT_PORTFOLIO_POSITIONEN.map((p, i) => ({
    id: `seed:${p.symbolYahoo}:${i}`,
    name: p.name,
    symbolYahoo: p.symbolYahoo,
    notierung: p.notierung,
    notiz: '',
  }))
}

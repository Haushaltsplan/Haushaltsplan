/**
 * Eingebaute Standard-Watchlist — bewusst leer.
 * Universum = Depot ∪ persönliche Watchlist (gespeichert), keine verkauften Hartcodes.
 */
export type PortfolioPositionDefinition = {
  name: string
  symbolYahoo: string
  notierung: string
}

export const DEFAULT_PORTFOLIO_POSITIONEN: PortfolioPositionDefinition[] = []

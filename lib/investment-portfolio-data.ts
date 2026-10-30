/**
 * Eingebaute Standard-Watchlist — bewusst leer.
 * Keine verkauften Hartcodes. Radar-Universum ist das Depot; die Watchlist wird separat gepflegt.
 */
export type PortfolioPositionDefinition = {
  name: string
  symbolYahoo: string
  notierung: string
}

export const DEFAULT_PORTFOLIO_POSITIONEN: PortfolioPositionDefinition[] = []

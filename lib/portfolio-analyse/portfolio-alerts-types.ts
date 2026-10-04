export type PortfolioAlertTyp =
  | 'radar_gruen'
  | 'radar_kaufzone'
  | 'earnings_heute'
  | 'earnings_morgen'
  | 'drawdown'

export type PortfolioAlert = {
  id: string
  typ: PortfolioAlertTyp
  ticker: string | null
  isin: string | null
  titel: string
  nachricht: string
  payload: Record<string, unknown>
  gelesenAm: string | null
  erstelltAm: string
}

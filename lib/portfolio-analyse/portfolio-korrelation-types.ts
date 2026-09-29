/** Depot-Korrelation — geteilte Typen (Client + Server). */

/** Hartes Yahoo-Batch-Limit; Depotaktien darunter vollständig vergleichen. */
export const KORRELATION_MAX_TICKER = 48

export type KorrelationPaar = {
  a: string
  b: string
  corr: number
}

export type BetaCluster = {
  id: string
  label: string
  ticker: string[]
  avgCorr: number
}

export type KorrelationAusgelassen = {
  ticker: string
  grund: 'limit' | 'keine-kurse'
}

export type PortfolioKorrelationPaket = {
  ok: boolean
  ticker: string[]
  matrix: number[][]
  beta: Record<string, number | null>
  hohePaare: KorrelationPaar[]
  cluster: BetaCluster[]
  hinweis: string | null
  geladenAm: string
  angefragt: number
  ausgelassen: KorrelationAusgelassen[]
}

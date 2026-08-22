/** Depot-Korrelation — geteilte Typen (Client + Server). */

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

export type PortfolioKorrelationPaket = {
  ok: boolean
  ticker: string[]
  matrix: number[][]
  beta: Record<string, number | null>
  hohePaare: KorrelationPaar[]
  cluster: BetaCluster[]
  hinweis: string | null
  geladenAm: string
}

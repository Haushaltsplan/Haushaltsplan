export type ZielDimension = 'assetklasse' | 'sektor' | 'titel'

export type ZielGewicht = {
  id: string
  dimension: ZielDimension
  schluessel: string
  label: string
  zielPct: number
}

export type RebalancingTrade = {
  schluessel: string
  label: string
  dimension: ZielDimension
  istPct: number
  zielPct: number
  diffPct: number
  diffEur: number
  aktion: 'kaufen' | 'trimmen' | 'ok'
}

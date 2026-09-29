export type ScreenerBoerse = 'Nasdaq' | 'NYSE' | 'CBOE'

export const SCREENER_SCHEMA_VERSION = 2

export type ScreenerHistPunkt = {
  jahr: number
  umsatzMio: number | null
  ebitMio: number | null
  niMio: number | null
  fcfMio: number | null
  ekMio: number | null
  eps: number | null
  debtMio?: number | null
  cashMio?: number | null
  daMio?: number | null
  aktienMio?: number | null
}

export type ScreenerZeile = {
  ticker: string
  name: string
  boerse: ScreenerBoerse
  cik: number
  sektor?: string | null
  industrie?: string | null
  umsatzMio: number | null
  ebitMio: number | null
  niMio: number | null
  ocfMio: number | null
  fcfMio: number | null
  ekMio: number | null
  assetsMio: number | null
  debtMio?: number | null
  cashMio?: number | null
  niMargePct: number | null
  ebitMargePct: number | null
  roePct: number | null
  roicPct?: number | null
  fcfMargePct: number | null
  fcfConversionPct?: number | null
  capexSalesPct?: number | null
  umsatzWachstumPct: number | null
  umsatzCagr3y: number | null
  umsatzCagr5y: number | null
  umsatzCagr10y: number | null
  epsCagr5y?: number | null
  fcfCagr5y?: number | null
  ruleOf40?: number | null
  niMargeMedian: number | null
  aktienVerwaesserungJaehrlichPct?: number | null
  netDebtMio?: number | null
  netDebtEbitda?: number | null
  jahreAnzahl: number
  vonJahr: number | null
  bisJahr: number | null
  kurs: number | null
  marktkapMio: number | null
  kgv: number | null
  kuv: number | null
  kbv: number | null
  hist?: ScreenerHistPunkt[]
}

export type ScreenerSnapshot = {
  periode: string
  aktualisiertAm: string
  n: number
  schemaVersion?: number
  zeilen: ScreenerZeile[]
}

export type ScreenerKennzahl =
  | 'umsatzMio'
  | 'marktkapMio'
  | 'jahreAnzahl'
  | 'roePct'
  | 'roicPct'
  | 'ebitMargePct'
  | 'niMargePct'
  | 'fcfMargePct'
  | 'umsatzWachstumPct'
  | 'umsatzCagr3y'
  | 'umsatzCagr5y'
  | 'umsatzCagr10y'
  | 'epsCagr5y'
  | 'fcfCagr5y'
  | 'ruleOf40'
  | 'fcfConversionPct'
  | 'capexSalesPct'
  | 'aktienVerwaesserungJaehrlichPct'
  | 'netDebtEbitda'
  | 'kgv'
  | 'kuv'
  | 'kbv'

export type ScreenerSort = ScreenerKennzahl | 'name' | 'mantra' | 'ticker'

export type ScreenerSpanne = {
  min?: number | null
  max?: number | null
}

export type ScreenerFilter = {
  suche: string
  boerse: 'alle' | ScreenerBoerse
  nurGewinn: boolean
  fcfPositiv: boolean
  aktienSinkend: boolean
  ekPositiv: boolean
  lueckenErlaubt: boolean
  /** Mantra-Cashflow: Conversion ≥ x oder Rule of 40 ≥ y. */
  conversionOderRo40: { conversionMin: number; ruleOf40Min: number } | null
  sort: ScreenerSort
  sortAsc: boolean
  spannen: Partial<Record<ScreenerKennzahl, ScreenerSpanne>>
}

export type ScreenerVorlage = {
  id: string
  name: string
  hinweis: string
  eingebaut: boolean
  filter: ScreenerFilter
}

export type ScreenerEigeneVorlage = {
  id: string
  name: string
  filter: ScreenerFilter
  aktualisiertAm: string
}

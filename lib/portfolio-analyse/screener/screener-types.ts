export type ScreenerBoerse = 'Nasdaq' | 'NYSE' | 'CBOE'

export const SCREENER_SCHEMA_VERSION = 10

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
  iroicPct?: number | null
  roic5yAvgPct?: number | null
  waccPct?: number | null
  incrementalValueSpreadPct?: number | null
  bruttoMargePct?: number | null
  bruttoMargeStabil?: boolean | null
  reinvestitionsquotePct?: number | null
  fcfJeAktieCagr5y?: number | null
  interestCoverage?: number | null
  sbcOcfPct?: number | null
  jahreAnzahl: number
  vonJahr: number | null
  bisJahr: number | null
  kurs: number | null
  marktkapMio: number | null
  kgv: number | null
  kuv: number | null
  kbv: number | null
  /** Kurs heute / Ø-EPS der letzten 5 GJ (normalisiertes KGV). */
  kgv5y?: number | null
  /** Marktkap heute / Ø-Umsatz 5J. */
  kuv5y?: number | null
  /** Marktkap heute / Ø-EK 5J. */
  kbv5y?: number | null
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
  | 'iroicPct'
  | 'roic5yAvgPct'
  | 'incrementalValueSpreadPct'
  | 'bruttoMargePct'
  | 'reinvestitionsquotePct'
  | 'fcfJeAktieCagr5y'
  | 'interestCoverage'
  | 'sbcOcfPct'
  | 'kgv'
  | 'kuv'
  | 'kbv'
  | 'kgv5y'
  | 'kuv5y'
  | 'kbv5y'
  | 'waccPct'

export type ScreenerSort = ScreenerKennzahl | 'name' | 'mantra' | 'quality' | 'ticker'

export type ScreenerSpanne = {
  min?: number | null
  max?: number | null
}

export type ScreenerFilter = {
  suche: string
  boerse: 'alle' | ScreenerBoerse
  /** Leerer String = alle Sektoren; sonst exakter Sektor-Name. */
  sektor: string
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

export type ScreenerEigeneVorlage = {
  id: string
  name: string
  filter: ScreenerFilter
  /** Sichtbare Tabellenspalten (IDs); fehlend = Client-Defaults. */
  spalten?: string[]
  aktualisiertAm: string
}

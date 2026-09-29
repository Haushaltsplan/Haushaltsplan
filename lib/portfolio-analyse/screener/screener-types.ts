export type ScreenerBoerse = 'Nasdaq' | 'NYSE' | 'CBOE'

export type ScreenerHistPunkt = {
  jahr: number
  umsatzMio: number | null
  ebitMio: number | null
  niMio: number | null
  fcfMio: number | null
  ekMio: number | null
  eps: number | null
}

export type ScreenerZeile = {
  ticker: string
  name: string
  boerse: ScreenerBoerse
  cik: number
  umsatzMio: number | null
  ebitMio: number | null
  niMio: number | null
  ocfMio: number | null
  fcfMio: number | null
  ekMio: number | null
  assetsMio: number | null
  niMargePct: number | null
  ebitMargePct: number | null
  roePct: number | null
  fcfMargePct: number | null
  umsatzWachstumPct: number | null
  umsatzCagr3y: number | null
  umsatzCagr5y: number | null
  umsatzCagr10y: number | null
  niMargeMedian: number | null
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
  zeilen: ScreenerZeile[]
}

export type ScreenerSort =
  | 'roe'
  | 'niMarge'
  | 'wachstum'
  | 'cagr5'
  | 'umsatz'
  | 'fcfMarge'
  | 'kgv'
  | 'name'

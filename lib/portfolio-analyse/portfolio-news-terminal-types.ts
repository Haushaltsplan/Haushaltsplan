export type NewsTerminalKategorie =
  | 'earnings'
  | 'dividende'
  | 'insider'
  | 'ma'
  | 'guidance'
  | 'produkt'
  | 'sonstiges'

export type NewsTerminalUnternehmen = {
  id: string
  name: string
  symbol: string | null
  isin: string | null
}

export type NewsTerminalDepotPosition = {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
}

export type NewsTerminalZeile = {
  id: string
  titel: string
  href: string
  quelle: string
  veroeffentlichtAm: string | null
  unternehmen: NewsTerminalUnternehmen[]
  kategorie: NewsTerminalKategorie
  istHeute: boolean
}

export type NewsTerminalPaket = {
  zeilen: NewsTerminalZeile[]
  unternehmen: NewsTerminalUnternehmen[]
  fehler: string | null
  aktualisiertAm: string
}

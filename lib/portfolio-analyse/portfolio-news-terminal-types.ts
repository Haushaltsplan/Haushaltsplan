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

/** KI-Tagesfazit für ein Unternehmen (Deutsch, Flash-Free-Tier). */
export type NewsTerminalKiFazit = {
  symbol: string
  name: string
  fazit: string
  anzahlMeldungen: number
  fehler: string | null
}

export type NewsTerminalKiPaket = {
  fazite: NewsTerminalKiFazit[]
  zeitraum: 'heute' | '48h'
  aktualisiertAm: string
  modell: string | null
}

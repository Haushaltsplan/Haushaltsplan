export type BuchungsTyp =
  | 'kauf'
  | 'verkauf'
  | 'dividende'
  | 'zins'
  | 'einzahlung'
  | 'auszahlung'
  | 'steuer'
  | 'gebuehr'
  | 'sonstiges'

export type AssetKlasse = 'aktie' | 'etf' | 'anleihe' | 'crypto' | 'geldmarkt' | 'sonstiges'

export type ImportQuelle = 'pdf' | 'csv'

/** Anonymisierte Buchung — keine Rohbeschreibung, kein Saldo, keine Kontodaten. */
export type PortfolioBuchung = {
  buchungsHash: string
  datum: string
  typ: BuchungsTyp
  isin: string | null
  wertpapierName: string | null
  stueck: number | null
  kursEur: number | null
  betragEur: number
  /** Parqet-CSV „realizedgains“ (nur Verkäufe) — sonst FIFO-Berechnung. */
  realisierterGewinnEur?: number | null
  assetKlasse: AssetKlasse
  quelle: ImportQuelle
}

export type PortfolioPositionSnapshot = {
  isin: string | null
  name: string
  stueck: number
  kursEur: number | null
  wertEur: number
  assetKlasse: AssetKlasse
}

export type PortfolioImportErgebnis = {
  buchungen: PortfolioBuchung[]
  positionen: PortfolioPositionSnapshot[]
  depotwertEur: number | null
  hinweise: string[]
  statistik: {
    cashZeilen: number
    positionen: number
    cryptoPositionen: number
    doppelteHashes: number
  }
}

export type PortfolioAnalyseKennzahlen = {
  depotwertEur: number
  investiertEur: number
  gewinnVerlustEur: number
  gewinnVerlustProzent: number | null
  dividendenEur: number
  zinsenEur: number
  einzahlungenEur: number
  auszahlungenEur: number
  anzahlPositionen: number
  anzahlBuchungen: number
}

export type PortfolioDbBuchung = PortfolioBuchung & {
  id: string
  importiert_am: string
}

export type PortfolioDbSnapshot = {
  id: string
  erfasst_am: string
  depotwert_eur: number | null
  positionen: PortfolioPositionSnapshot[]
}

export const BUCHUNGS_TYP_LABEL: Record<BuchungsTyp, string> = {
  kauf: 'Kauf',
  verkauf: 'Verkauf',
  dividende: 'Dividende',
  zins: 'Zins',
  einzahlung: 'Einzahlung',
  auszahlung: 'Auszahlung',
  steuer: 'Steuer',
  gebuehr: 'Gebühr',
  sonstiges: 'Sonstiges',
}

export const ASSET_KLASSE_LABEL: Record<AssetKlasse, string> = {
  aktie: 'Aktien',
  etf: 'ETFs',
  anleihe: 'Anleihen',
  crypto: 'Krypto',
  geldmarkt: 'Geldmarkt',
  sonstiges: 'Sonstiges',
}

export const ASSET_KLASSE_FARBE: Record<AssetKlasse, string> = {
  aktie: '#6366f1',
  etf: '#22d3ee',
  anleihe: '#a78bfa',
  crypto: '#fbbf24',
  geldmarkt: '#34d399',
  sonstiges: '#94a3b8',
}

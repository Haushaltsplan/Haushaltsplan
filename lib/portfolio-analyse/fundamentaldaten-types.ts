/** Einheit für Zahlenformatierung in der UI. */
export type FundamentalEinheit =
  | 'prozent'
  | 'multiple'
  | 'zahl'
  | 'ratio'
  /** Macrotrends GuV/Cashflow: Wert in Millionen USD */
  | 'waehrung_usd_mio'
  /** USD je Aktie */
  | 'waehrung_usd_aktie'
  /** Ausstehende Aktien in Millionen */
  | 'aktien_mio'
  /** Absoluter USD-Betrag (Yahoo Marktkapitalisierung etc.) */
  | 'waehrung_usd'

export type FundamentalPeriode = {
  /** ISO-Datum, Geschäftsjahresende, Schätzungs-Ende oder __ttm__ / __fy0e__ / __fy1e__ */
  iso: string
  label: string
  istLtm?: boolean
  istSchaetzung?: boolean
}

export type FundamentalMetrikZeile = {
  id: string
  label: string
  gruppe:
    | 'finanzdaten'
    | 'cashflow'
    | 'rentabilitaet'
    | 'margen'
    | 'umschlag'
    | 'bewertung_forward'
    | 'bewertung_trailing'
    | 'schaetzungen'
  einheit: FundamentalEinheit
  werte: Record<string, number | null>
  macrotrendsSlug?: string
  macrotrendsStatement?: 'financial-ratios' | 'price-ratios' | 'income-statement' | 'cash-flow-statement'
  /** Schätzung vs. historisch */
  istSchaetzung?: boolean
}

export type FundamentalKeyMetric = {
  id: string
  label: string
  wert: string
  gruppe: 'marktdaten' | 'kapitalstruktur' | 'effizienz' | 'wachstum' | 'bewertung'
}

export type FundamentalNewsArtikel = {
  titel: string
  link: string
  quelle: string | null
  veroeffentlicht: string | null
  zusammenfassung: string | null
}

export type FundamentaldatenPaket = {
  ok: boolean
  ticker: string
  slug: string
  firmenname: string
  branche: string | null
  sektor: string | null
  website: string | null
  /** Firmenbeschreibung auf Deutsch */
  beschreibung: string | null
  waehrung: string
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  keyMetrics: FundamentalKeyMetric[]
  news: FundamentalNewsArtikel[]
  symbolYahoo: string | null
  geladenAm: string
  quelle: 'macrotrends'
  fehler?: string | null
}

export type FundamentaldatenAnfrage = {
  isin?: string | null
  name?: string
  symbolYahoo?: string | null
  symbolCandidates?: string[]
  tickerOverride?: string | null
}

/** Spezial-Schlüssel für TTM- und Schätzungs-Spalten */
export const FUNDAMENTAL_TTM_KEY = '__ttm__'
export const FUNDAMENTAL_FY0E_KEY = '__fy0e__'
export const FUNDAMENTAL_FY1E_KEY = '__fy1e__'

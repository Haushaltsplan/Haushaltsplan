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
  istNtm?: boolean
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
  gruppe:
    | 'marktdaten'
    | 'kapitalstruktur'
    | 'effizienz'
    | 'wachstum'
    | 'bewertung_ntm'
    | 'bewertung_ltm'
}

export type FundamentalNewsArtikel = {
  titel: string
  link: string
  quelle: string | null
  veroeffentlicht: string | null
  zusammenfassung: string | null
}

export type MantraAuditStatus = 'erfuellt' | 'nicht_erfuellt' | 'keine_daten' | 'qualitativ'

export type MantraAuditErgebnis = {
  kategorie: string
  kennzahl: string
  zielwert: string
  funktion: string
  istWert: string | null
  status: MantraAuditStatus
  hinweis?: string
}

export type FundamentalMantraMeta = {
  beta: number | null
  marketCapUsd: number | null
  totalDebtUsd: number | null
  totalCashUsd: number | null
  yahooFinanz: import('@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server').MantraYahooFinanzdaten | null
}

export type MoatPfeilerRef = {
  id: string
  titel: string
  beschreibung: string
  killerFrage: string
}

export type SellTriggerRef = {
  id: string
  titel: string
  beschreibung: string
}

export type FundamentalMantraAudit = {
  sektorMantraId: string | null
  sektorMantraTitel: string | null
  sektorMantraIntro: string | null
  standard: MantraAuditErgebnis[]
  sektor: MantraAuditErgebnis[]
  zusammenfassung: {
    erfuellt: number
    nichtErfuellt: number
    keineDaten: number
    qualitativ: number
    bewertbar: number
  }
  /** Quality Investing Framework — Abschnitt 1 */
  anker: string
  frameworkTitel: string
  frameworkUntertitel: string
  /** Abschnitt 3 — qualitative Burggräben */
  moatCheck: readonly MoatPfeilerRef[]
  moatPlattformZusatz: string
  /** Abschnitt 4 — Exit-Disziplin */
  sellTriggers: readonly SellTriggerRef[]
  sellTriggersHinweis: string
}

export type FundamentalDcfKontext = {
  basisFcfUsd: number | null
  basisFcfQuelle: 'TTM' | 'Letztes GJ' | null
  aktienAnzahl: number | null
  nettoverschuldungUsd: number | null
  aktuellerKursUsd: number | null
  beta: number | null
  fcfCagr3yPct: number | null
  fcfCagr5yPct: number | null
  umsatzwachstumPct: number | null
  waccVorschlagPct: number
  wachstumVorschlagPct: number
  terminalWachstumVorschlagPct: number
  prognoseJahreVorschlag: number
  risikofreierZinsPct: number
  marktrisikopraemiePct: number
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
  dcfKontext: FundamentalDcfKontext | null
  mantra: FundamentalMantraAudit
  mantraMeta: FundamentalMantraMeta | null
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
export const FUNDAMENTAL_NTM_KEY = '__ntm__'
export const FUNDAMENTAL_FY0E_KEY = '__fy0e__'
export const FUNDAMENTAL_FY1E_KEY = '__fy1e__'

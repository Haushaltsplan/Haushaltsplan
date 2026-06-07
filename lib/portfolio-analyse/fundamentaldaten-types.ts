/** Einheit für Zahlenformatierung in der UI. */
export type FundamentalEinheit = 'prozent' | 'multiple' | 'zahl' | 'waehrung_usd' | 'ratio'

export type FundamentalPeriode = {
  /** ISO-Datum (Geschäftsjahresende), z. B. 2025-09-30 */
  iso: string
  /** Anzeige z. B. 30.09.25 */
  label: string
  /** true = LTM/TTM-Spalte */
  istLtm?: boolean
}

export type FundamentalMetrikZeile = {
  id: string
  label: string
  gruppe: 'rentabilitaet' | 'margen' | 'umschlag' | 'bewertung_forward' | 'bewertung_trailing'
  einheit: FundamentalEinheit
  /** periodenIso → Wert (null = fehlend) */
  werte: Record<string, number | null>
  /** Macrotrends-Metrik-Slug für Chart-Abruf */
  macrotrendsSlug?: string
  macrotrendsStatement?: 'financial-ratios' | 'price-ratios'
}

export type FundamentalKeyMetric = {
  id: string
  label: string
  wert: string
  gruppe: 'marktdaten' | 'kapitalstruktur' | 'effizienz' | 'wachstum' | 'bewertung'
}

export type FundamentaldatenPaket = {
  ok: boolean
  ticker: string
  slug: string
  firmenname: string
  branche: string | null
  website: string | null
  beschreibung: string | null
  waehrung: string
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  keyMetrics: FundamentalKeyMetric[]
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
  /** Manueller Macrotrends-Ticker (z. B. AAPL) bei fehlender Auflösung */
  tickerOverride?: string | null
}

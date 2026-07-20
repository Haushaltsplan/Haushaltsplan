/** SEC Quartals- & Jahresberichte (10-Q / 10-K). */

export type SecBerichtFormular =
  | '10-Q'
  | '10-K'
  /** 8-K Item 2.02 Earnings Release (EX-99), bevor 10-Q/10-K da ist */
  | '8-K-ER'
  | 'IR-Q'
  | 'IR-HY'
  | 'IR-FY'
  | 'IR-AR'

export type SecBerichtQuelle = 'sec_edgar' | 'ir_pdf'

export type SecBerichtAnfrage = {
  ticker: string
  firmenname?: string | null
  isin?: string | null
  force?: boolean
  /** Volltext eines Eintrags nachladen */
  accession?: string | null
  /** KI-Zusammenfassung für diesen Bericht (id = accession-formular) */
  berichtId?: string | null
  /** Gespeicherte KI-Zusammenfassung erneut erzeugen */
  forceKi?: boolean
}

export type SecBerichtEintrag = {
  id: string
  formular: SecBerichtFormular
  label: string
  filingDatum: string | null
  berichtszeitraum: string | null
  url: string
  quelle: SecBerichtQuelle
  accession: string
  /** Kurzauszug; Volltext bei Detail-Abruf */
  textAuszug: string
  textZeichen: number
  textVollstaendig: boolean
  zusammenfassung: string | null
}

export type SecBerichtePaket = {
  ok: boolean
  ticker: string
  berichte: SecBerichtEintrag[]
  aktiverBerichtId: string | null
  geladenAm: string
  ausCache: boolean
  fehler?: string | null
  hinweis?: string | null
}

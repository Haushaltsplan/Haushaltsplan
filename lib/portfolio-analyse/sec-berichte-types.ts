/** SEC Quartals- & Jahresberichte (10-Q / 10-K). */

export type SecBerichtFormular = '10-Q' | '10-K'

export type SecBerichtQuelle = 'sec_edgar'

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

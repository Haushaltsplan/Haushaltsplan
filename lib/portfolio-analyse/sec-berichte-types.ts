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
}

export type SecBerichtePaket = {
  ok: boolean
  ticker: string
  berichte: SecBerichtEintrag[]
  geladenAm: string
  ausCache: boolean
  fehler?: string | null
  hinweis?: string | null
}

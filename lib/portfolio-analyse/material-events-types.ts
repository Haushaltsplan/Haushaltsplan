/** Material Events — SEC 8-K (US) & Ad-hoc (EU). */

export type MaterialEventKategorie =
  | 'guidance'
  | 'management'
  | 'm_a'
  | 'restrukturierung'
  | 'finanzergebnis'
  | 'regulatorisch'
  | 'sonstiges'

export type MaterialEventQuelle = 'sec_8k' | 'eu_adhoc'

export type MaterialEventEintrag = {
  id: string
  titel: string
  kategorie: MaterialEventKategorie
  quelle: MaterialEventQuelle
  datum: string | null
  url: string
  textAuszug: string
  items?: string[]
}

export type MaterialEventsPaket = {
  ok: boolean
  ticker: string
  events: MaterialEventEintrag[]
  geladenAm: string
  hinweis?: string | null
  fehler?: string | null
}

export type MaterialEventsAnfrage = {
  ticker: string
  firmenname?: string | null
  isin?: string | null
  force?: boolean
}

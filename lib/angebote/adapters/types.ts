import type { Angebot, HaendlerId, MarktInfo } from '@/lib/angebote/types'

export type AdapterKontext = {
  plz: string
  maerkte: MarktInfo[]
  marktId?: string
}

export type AdapterErgebnis = {
  haendler: HaendlerId
  angebote: Angebot[]
  quelle: 'direkt' | 'marktguru'
}

export type AngeboteAdapter = {
  haendler: HaendlerId
  /** true = hat Direktquelle; false = nur über Marktguru */
  istDirekt: boolean
  fetchAngebote: (ctx: AdapterKontext) => Promise<AdapterErgebnis>
}

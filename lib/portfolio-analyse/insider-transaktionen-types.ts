/** Insider-Käufe/-Verkäufe (US Form 4, EU Directors' Dealings). */

export type InsiderTransaktionTyp = 'kauf' | 'verkauf' | 'sonstiges'

export type InsiderTransaktion = {
  id: string
  datum: string | null
  person: string
  titel: string | null
  typ: InsiderTransaktionTyp
  aktien: number | null
  preisUsd: number | null
  wertUsd: number | null
  quelle: 'sec_form4' | 'eu_directors_dealing' | 'eu_amf' | 'eu_dgap'
  url: string
  hinweis: string | null
}

export type InsiderTransaktionenPaket = {
  ok: boolean
  ticker: string
  transaktionen: InsiderTransaktion[]
  kaufSummeUsd: number | null
  verkaufSummeUsd: number | null
  nettoKaufUsd: number | null
  geladenAm: string
  hinweis: string | null
  fehler?: string | null
}

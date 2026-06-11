/** Earnings Call — Quartale, Transkripte & KI-Zusammenfassungen. */

export type EarningsCallQuelle = 'sec_edgar' | 'finnhub' | 'ir_scrape' | 'motley_fool' | 'marketbeat'

export type EarningsCallAnfrage = {
  ticker: string
  firmenname?: string | null
  isin?: string | null
  force?: boolean
  /** Nur Zusammenfassung für dieses Quartal nachladen (z. B. 2024-Q1) */
  quartalId?: string | null
  /** Gespeicherte KI-Zusammenfassung erneut erzeugen (sonst aus Cache) */
  forceKi?: boolean
}

export type EarningsCallQuartalEintrag = {
  id: string
  jahr: number
  quartal: 1 | 2 | 3 | 4
  label: string
  titel: string
  callDatum: string | null
  transcriptUrl: string
  quelle: EarningsCallQuelle
  transcriptZeichen: number
  zusammenfassung: string | null
}

export type EarningsCallPaket = {
  ok: boolean
  ticker: string
  quartale: EarningsCallQuartalEintrag[]
  aktivesQuartalId: string | null
  geladenAm: string
  ausCache: boolean
  fehler?: string | null
  hinweis?: string | null
  investorRelationsUrl?: string | null
}

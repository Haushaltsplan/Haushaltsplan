/** Earnings Call — Transkript & KI-Zusammenfassung (Seeking Alpha). */

export type EarningsCallAnfrage = {
  ticker: string
  firmenname?: string | null
  /** Cache umgehen und neu scrapen + zusammenfassen */
  force?: boolean
}

export type EarningsCallPaket = {
  ok: boolean
  ticker: string
  titel: string | null
  transcriptUrl: string | null
  callDatum: string | null
  transcriptZeichen: number
  zusammenfassung: string | null
  geladenAm: string
  ausCache: boolean
  quelle: 'seeking_alpha'
  fehler?: string | null
  hinweis?: string | null
}

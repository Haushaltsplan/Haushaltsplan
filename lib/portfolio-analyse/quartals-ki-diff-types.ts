/** Quartals-zu-Quartals-KI-Diff — Änderungen zwischen zwei KI-Summaries. */

export type QuartalsKiDiffTyp = 'earnings_call' | 'sec_bericht'

export type QuartalsKiDiffAnfrage = {
  ticker: string
  firmenname?: string | null
  typ: QuartalsKiDiffTyp
  /** Aktuelles Quartal / Bericht (neuer) */
  aktuellId: string
  /** Vorquartal / Vorbericht */
  vorherId: string
  force?: boolean
}

export type QuartalsKiDiffPaket = {
  ok: boolean
  ticker: string
  typ: QuartalsKiDiffTyp
  aktuellId: string
  vorherId: string
  aktuellLabel: string | null
  vorherLabel: string | null
  diff: string | null
  geladenAm: string
  ausCache: boolean
  fehler?: string | null
}

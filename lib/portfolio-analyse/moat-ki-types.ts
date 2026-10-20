/** Qualitativer KI-Moat-Check — ergänzt die regelbasierte Scorecard-Spalte Burggraben. */

export type MoatPfeilerId =
  | 'preissetzungsmacht'
  | 'replikationsbarriere'
  | 'wechselkosten'
  | 'marktdichte'

export type MoatPfeilerBewertung = {
  id: MoatPfeilerId
  /** 1–10, skeptisch kalibriert */
  score: number
  /** 1–2 Sätze, deutsch */
  begruendung: string
  /** Was das Modell zerstören könnte */
  risiko: string
}

export type MoatKiUrteil = 'tief' | 'moderat' | 'schwach' | 'unklar'

export type MoatKiBewertung = {
  ticker: string
  isin: string | null
  firmenname: string
  /** Kurz: was das Unternehmen verkauft / wie es verdient */
  geschaeftsmodell: string
  pfeiler: MoatPfeilerBewertung[]
  /** Gewichteter Gesamtscore 1–10 */
  score: number
  urteil: MoatKiUrteil
  /** Harte Kaufdisziplin für Qualitäts-Moat-Investor */
  kaufwuerdig: boolean
  kaufHinweis: string
  /** 2–4 Zerstörungsszenarien */
  zerstoerungsszenarien: string[]
  stand: string
  kiModell: string | null
}

/** Gesamtscore für Quality-Kauf — 7 reicht (skeptische KI straft CapEx/Investitionsphasen oft ab). */
export const MOAT_KAUF_MIN_SCORE = 7
export const MOAT_KAUF_MIN_PFEILER = 6
export const MOAT_KAUF_MIN_STARKE_PFEILER = 2
/** „Starker“ Pfeiler ab 7 — nicht erst ab 8. */
export const MOAT_KAUF_STARKE_SCHWELLE = 7
/** Ab hier UI-Label „tiefes Moat“ (darüber hinaus nur Nuance). */
export const MOAT_TIEF_SCORE = 8

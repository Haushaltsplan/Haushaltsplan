import type { MoatKiBewertung } from '@/lib/portfolio-analyse/moat-ki-types'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export type MoatShortMetrik = { id: string; label: string; value: string; hook: boolean }

export type MoatShortHookVariante = {
  winkel: string
  kicker: string
  /** Frage, ohne Kennzahl. */
  claim: string
  /** Kennzahl als Antwort. */
  proof: string
  loop: string
  /** Offene Brücke in die Frage — endet mit „so the question is“. */
  land: string
  metrikId: string
}

export type MoatShortErgebnis = {
  props: MoatShortProps
  metriken: MoatShortMetrik[]
  hookVarianten: MoatShortHookVariante[]
  moat: MoatKiBewertung
  moatAusCache: boolean
  title: string
  description: string
  /** Angepinnter Kommentar — eine Streitfrage, kein Subscribe. */
  kommentar: string
  /** Echte YouTube-Suchvorschläge zu Ticker/Firma. */
  suchphrasen: string[]
  warnungen: string[]
}

export type MoatShortAntwort = ({ ok: true } & MoatShortErgebnis) | { ok: false; fehler: string }

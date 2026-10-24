import type { MoatKiBewertung } from '@/lib/portfolio-analyse/moat-ki-types'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export type MoatShortMetrik = { id: string; label: string; value: string; hook: boolean }

export type MoatShortHookVariante = {
  winkel: string
  claim: string
  loop: string
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
  warnungen: string[]
}

export type MoatShortAntwort = ({ ok: true } & MoatShortErgebnis) | { ok: false; fehler: string }

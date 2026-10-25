import type { EarningsShortProps } from '@/remotion/earnings-short-types'

export type EarningsShortLuecke = {
  art: 'beatMiss' | 'call'
  hinweis: string
}

export type EarningsShortErgebnis = {
  props: EarningsShortProps
  title: string
  description: string
  kommentar: string
  suchphrasen: string[]
  warnungen: string[]
  quartalLabel: string
  callLabel: string
  hatBericht: boolean
}

export type EarningsShortAntwort =
  | ({ ok: true } & EarningsShortErgebnis)
  | { ok: false; fehler: string; luecken?: EarningsShortLuecke[] }

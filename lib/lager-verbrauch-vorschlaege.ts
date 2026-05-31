import type { VerbrauchKennzahlen } from '@/lib/lager-einkaufsliste-verbrauch'

export type MindestbestandVorschlag = {
  produktId: string
  name: string
  aktuell: number
  vorschlag: number
  einheit: string
  grund: string
}

/** Mindestbestand ≈ 2 Wochen Verbrauch (aus Ø/Woche), mindestens 1. */
export function vorschlagMindestbestand(kenn: VerbrauchKennzahlen): number | null {
  const w = kenn.durchschnittProWoche
  if (!Number.isFinite(w) || w <= 0) return null
  const v = Math.ceil(w * 2 * 10) / 10
  return Math.max(1, Math.min(v, 999))
}

export type ToterBestandHinweis = {
  produktId: string
  name: string
  menge: number
  einheit: string
  tageSeitEinkauf: number | null
}

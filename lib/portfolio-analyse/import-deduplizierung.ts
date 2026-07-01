/**
 * Weiche Deduplizierung bei PDF-Import: Kontoauszug + Wertpapierabrechnung
 * erzeugen oft dieselbe Transaktion mit leicht abweichenden Beträgen (Brutto vs. Netto+Gebühr).
 */

import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

const HANDELS_TYPEN = new Set<PortfolioBuchung['typ']>(['kauf', 'verkauf', 'dividende'])

function bevorzugeHandelsbuchung(a: PortfolioBuchung, b: PortfolioBuchung): PortfolioBuchung {
  if (a.quelle !== b.quelle) return a.quelle === 'csv' ? a : b

  if (a.typ === 'kauf') {
    const stkA = Math.abs(a.stueck ?? 0)
    const stkB = Math.abs(b.stueck ?? 0)
    if (stkA > 0 && stkB > 0 && Math.abs(stkA - stkB) < 0.0001) {
      if (a.betragEur < b.betragEur - 0.5) return a
      if (b.betragEur < a.betragEur - 0.5) return b
    }
  }

  if (a.typ === 'dividende') {
    return Math.abs(a.betragEur - b.betragEur) <= 0.05
      ? a
      : a.betragEur <= b.betragEur
        ? a
        : b
  }

  return a.betragEur >= b.betragEur ? a : b
}

export function sindGleicheHandelsbuchung(a: PortfolioBuchung, b: PortfolioBuchung): boolean {
  if (a.datum !== b.datum || a.typ !== b.typ) return false

  const isinA = a.isin?.toUpperCase() ?? ''
  const isinB = b.isin?.toUpperCase() ?? ''
  if (isinA && isinB && isinA !== isinB) return false
  if (!isinA && !isinB) return false

  if (Math.abs(a.betragEur - b.betragEur) < 0.03) return true

  const gross = Math.max(a.betragEur, b.betragEur)
  const net = Math.min(a.betragEur, b.betragEur)
  if (gross - net > 0 && gross - net <= 10) return true

  const stkA = Math.abs(a.stueck ?? 0)
  const stkB = Math.abs(b.stueck ?? 0)
  if (stkA > 0 && stkB > 0 && Math.abs(stkA - stkB) < 0.0001) {
    return gross - net <= 10
  }

  return false
}

/** Entfernt wahrscheinliche Doppelbuchungen vor dem Hash-Dedup (v. a. PDF-Kontoauszug + Abrechnung). */
export function bereinigeDoppelteHandelsbuchungen(buchungen: PortfolioBuchung[]): PortfolioBuchung[] {
  const handels: PortfolioBuchung[] = []
  const andere: PortfolioBuchung[] = []

  for (const b of buchungen) {
    if (HANDELS_TYPEN.has(b.typ)) handels.push(b)
    else andere.push(b)
  }

  const skip = new Set<number>()
  const kept: PortfolioBuchung[] = []

  for (let i = 0; i < handels.length; i++) {
    if (skip.has(i)) continue
    let best = handels[i]!
    for (let j = i + 1; j < handels.length; j++) {
      if (skip.has(j)) continue
      if (!sindGleicheHandelsbuchung(best, handels[j]!)) continue
      skip.add(j)
      best = bevorzugeHandelsbuchung(best, handels[j]!)
    }
    kept.push(best)
  }

  return [...andere, ...kept]
}

/** Filtert neue Buchungen, die inhaltlich schon in der DB sind (nicht nur gleicher Hash). */
export function filterGegenBestehendeHandelsbuchungen(
  neu: PortfolioBuchung[],
  bestehend: PortfolioBuchung[],
): { neu: PortfolioBuchung[]; uebersprungen: number } {
  if (bestehend.length === 0) return { neu, uebersprungen: 0 }

  const handelsBestehend = bestehend.filter((b) => HANDELS_TYPEN.has(b.typ))
  let uebersprungen = 0
  const out: PortfolioBuchung[] = []

  for (const b of neu) {
    if (
      HANDELS_TYPEN.has(b.typ) &&
      handelsBestehend.some((alt) => sindGleicheHandelsbuchung(b, alt))
    ) {
      uebersprungen++
      continue
    }
    out.push(b)
  }

  return { neu: out, uebersprungen }
}

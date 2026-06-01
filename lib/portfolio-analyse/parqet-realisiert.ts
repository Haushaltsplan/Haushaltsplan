import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Parqet-Dashboard „Realisiert“ = Summe `realizedgains` nur bei type=Sell.
 * TransferOut/Umbuchungen haben eigene realizedgains, zählen dort nicht mit.
 */
export function buchungZaehltFuerParqetRealisiert(b: PortfolioBuchung): boolean {
  if (b.typ !== 'verkauf') return false
  if (b.realisierterGewinnEur == null || !Number.isFinite(b.realisierterGewinnEur)) return false

  const pt = b.parqetTyp?.trim().toLowerCase()
  if (pt) return pt === 'sell'

  // Ältere Imports: TransferOut als Verkauf mit fälschlich gespeichertem realizedgains
  if (b.betragEur <= 0.02 && (b.kursEur == null || b.kursEur <= 0)) return false

  return true
}

/** Summe der Parqet-realisierten Gewinne; `null` wenn keine Parqet-Werte vorhanden. */
export function summeParqetRealisiertAusBuchungen(buchungen: PortfolioBuchung[]): number | null {
  const zeilen = buchungen.filter(buchungZaehltFuerParqetRealisiert)
  if (zeilen.length === 0) return null
  return round2(zeilen.reduce((s, b) => s + (b.realisierterGewinnEur ?? 0), 0))
}

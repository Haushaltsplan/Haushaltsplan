/**
 * Parqet „Investiert“ / Einstand: Handelswert ohne doppelt gezählte Gebühren.
 * PDF-Kontoauszug: Brutto-Zahlungsausgang; Wertpapierabrechnung: Netto + separate Gebühr.
 */

import { istAktiendividendeAlsKauf } from '@/lib/portfolio-analyse/dividenden-buchung'
import { irrBetragFuerKauf } from '@/lib/portfolio-analyse/parqet-xirr'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Gebühren + Steuern je Datum|ISIN (aus separaten Buchungszeilen). */
export function gebuehrSteuerIndex(buchungen: PortfolioBuchung[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of buchungen) {
    if (b.typ !== 'gebuehr' && b.typ !== 'steuer') continue
    const isin = b.isin?.toUpperCase()
    if (!isin) continue
    const key = `${b.datum}|${isin}`
    map.set(key, round2((map.get(key) ?? 0) + b.betragEur))
  }
  return map
}

/**
 * Einstandskosten für einen Kauf (ohne Cashflow — der bleibt brutto).
 * Entspricht Parqet: zugeführtes Kapital steigt um Handelswert, nicht um Ordergebühr.
 */
export function kaufEinstandBetragEur(
  b: PortfolioBuchung,
  feeIndex: Map<string, number>,
): number {
  if (istAktiendividendeAlsKauf(b)) return 0

  const stk = Math.abs(b.stueck ?? 0)
  const handelFromKurs =
    stk > 0 && b.kursEur != null && b.kursEur > 0 ? round2(stk * b.kursEur) : null

  if (handelFromKurs != null && handelFromKurs > 0 && handelFromKurs < b.betragEur - 0.02) {
    return handelFromKurs
  }

  const netFromIrr = irrBetragFuerKauf(b)
  if (netFromIrr < b.betragEur - 0.02) return netFromIrr

  const isin = b.isin?.toUpperCase()
  if (isin) {
    const fees = feeIndex.get(`${b.datum}|${isin}`) ?? 0
    if (fees > 0 && b.betragEur > fees) {
      return round2(b.betragEur - fees)
    }
  }

  return round2(b.betragEur)
}

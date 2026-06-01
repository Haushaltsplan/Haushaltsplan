/**
 * XIRR-Cashflows wie Parqet (geldgewichtete Rendite / IZF):
 * Nur Geldflüsse über die Portfolio-Grenze — keine internen Käufe/Verkäufe,
 * die nur Cash gegen Wertpapiere tauschen (sonst Doppelzählung mit Einzahlungen).
 */

import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type IrrCashflow = { date: Date; amount: number }

function datumAlsDate(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Kalendertage mit Einzahlung (für Paarung mit Käufen am selben Tag). */
function tageMitEinzahlung(buchungen: PortfolioBuchung[]): Set<string> {
  const s = new Set<string>()
  for (const b of buchungen) {
    if (b.typ === 'einzahlung') s.add(b.datum)
  }
  return s
}

/**
 * Cashflows für Portfolio-XIRR (Parqet-kompatibel).
 * - Negativ: Einzahlung, Steuern, Gebühren; Käufe nur ohne Einzahlung am selben Tag (z. B. Saveback)
 * - Positiv: Auszahlung, Dividenden, Zinsen (keine Verkäufe — Erlös steckt im Terminalwert)
 */
export function parqetIrrCashflowsAusBuchungen(buchungen: PortfolioBuchung[]): IrrCashflow[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const mitEinzahlung = tageMitEinzahlung(sortiert)
  const flows: IrrCashflow[] = []

  for (const b of sortiert) {
    const d = datumAlsDate(b.datum)
    if (!d) continue

    switch (b.typ) {
      case 'einzahlung':
      case 'steuer':
      case 'gebuehr':
        flows.push({ date: d, amount: -Math.abs(b.betragEur) })
        break
      case 'auszahlung':
      case 'dividende':
      case 'zins':
        flows.push({ date: d, amount: Math.abs(b.betragEur) })
        break
      case 'kauf':
        if (!mitEinzahlung.has(b.datum)) {
          flows.push({ date: d, amount: -Math.abs(b.betragEur) })
        }
        break
      case 'verkauf':
        break
      default:
        break
    }
  }

  return flows
}

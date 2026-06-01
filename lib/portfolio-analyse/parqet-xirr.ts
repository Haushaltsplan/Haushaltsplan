/**
 * XIRR / IZF wie Parqet (Hilfe: „Tagesgeldkonto“-Modell):
 * - Kauf = Einzahlung auf das virtuelle Konto (negativ)
 * - Verkauf = Auszahlung vom Konto (positiv)
 * - Dividenden, Zinsen = Erträge (positiv)
 * - Bank-Einzahlung nur ohne Kauf am selben Tag (sonst Doppelzählung)
 * - Bank-Auszahlung nur ohne Verkauf am selben Tag
 * Steuern/Gebühren sind in den Nettobeträgen der Trades bereits enthalten.
 */

import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type IrrCashflow = { date: Date; amount: number }

function datumAlsDate(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isFinite(d.getTime()) ? d : null
}

function tageMitTyp(buchungen: PortfolioBuchung[], typ: PortfolioBuchung['typ']): Set<string> {
  const s = new Set<string>()
  for (const b of buchungen) {
    if (b.typ === typ) s.add(b.datum)
  }
  return s
}

/** Cashflows für Portfolio-XIRR (Parqet IZF / geldgewichtete Rendite). */
export function parqetIrrCashflowsAusBuchungen(buchungen: PortfolioBuchung[]): IrrCashflow[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const tageKauf = tageMitTyp(sortiert, 'kauf')
  const tageVerkauf = tageMitTyp(sortiert, 'verkauf')
  const flows: IrrCashflow[] = []

  for (const b of sortiert) {
    const d = datumAlsDate(b.datum)
    if (!d) continue

    switch (b.typ) {
      case 'kauf':
        flows.push({ date: d, amount: -Math.abs(b.betragEur) })
        break
      case 'verkauf':
        flows.push({ date: d, amount: Math.abs(b.betragEur) })
        break
      case 'dividende':
      case 'zins':
        flows.push({ date: d, amount: Math.abs(b.betragEur) })
        break
      case 'einzahlung':
        if (!tageKauf.has(b.datum)) {
          flows.push({ date: d, amount: -Math.abs(b.betragEur) })
        }
        break
      case 'auszahlung':
        if (!tageVerkauf.has(b.datum)) {
          flows.push({ date: d, amount: Math.abs(b.betragEur) })
        }
        break
      default:
        break
    }
  }

  return flows
}

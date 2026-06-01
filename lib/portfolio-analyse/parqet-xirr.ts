/**
 * Portfolio-IZF / XIRR wie Parqet (Dashboard, gesamtes Depot):
 *
 * Parqet-Metapher: Kauf = Einzahlung auf ein „Tagesgeldkonto“, Verkauf würde Auszahlung
 * bedeuten — am Depot bleibt der Erlös aber im Portfoliowert (Cash/Neuinvestition).
 * Daher: Käufe als negative Flows, Dividenden/Zinsen positiv, kein Verkaufs-Cashflow,
 * Terminal = aktueller Depotwert.
 *
 * Bank-Einzahlungen (einzahlung) nur, wenn es keine Käufe gibt (reines Cash) oder wenn
 * noch kein Kauf im Depot war — sonst Doppelzählung (Deposit + Buy aus Parqet-CSV).
 *
 * Kauf-Betrag: Handelswert (Stück × Kurs) wie Parqet „amount“, nicht nochmals + Gebühr,
 * wenn Gebühr bereits in der CSV-Zeile enthalten war.
 */

import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type IrrCashflow = { date: Date; amount: number }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function datumAlsDate(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isFinite(d.getTime()) ? d : null
}

function hatKaeufe(buchungen: PortfolioBuchung[]): boolean {
  return buchungen.some((b) => b.typ === 'kauf')
}

/** Investitionsbetrag für IZF (ohne doppelte Gebühr im Kauf-Flow). */
export function irrBetragFuerKauf(b: PortfolioBuchung): number {
  const stk = b.stueck != null ? Math.abs(b.stueck) : 0
  if (stk > 0 && b.kursEur != null && b.kursEur > 0) {
    const handelswert = round2(stk * b.kursEur)
    if (handelswert > 0 && handelswert <= b.betragEur + 0.02) return handelswert
  }
  return Math.abs(b.betragEur)
}

/** Cashflows für Portfolio-XIRR (Parqet IZF). */
export function parqetIrrCashflowsAusBuchungen(buchungen: PortfolioBuchung[]): IrrCashflow[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const mitKaeufen = hatKaeufe(sortiert)
  const flows: IrrCashflow[] = []

  for (const b of sortiert) {
    const d = datumAlsDate(b.datum)
    if (!d) continue

    switch (b.typ) {
      case 'kauf':
        flows.push({ date: d, amount: -irrBetragFuerKauf(b) })
        break
      case 'verkauf':
        // Kein Flow — Erlös bleibt im Depot (Terminalwert).
        break
      case 'dividende':
      case 'zins':
        flows.push({ date: d, amount: Math.abs(b.betragEur) })
        break
      case 'einzahlung':
        if (!mitKaeufen) {
          flows.push({ date: d, amount: -Math.abs(b.betragEur) })
        }
        break
      case 'auszahlung':
        flows.push({ date: d, amount: Math.abs(b.betragEur) })
        break
      case 'steuer':
      case 'gebuehr':
        // Bereits in Netto-Kauf/Dividende oder separat in Parqet — nicht doppelt zählen.
        break
      default:
        break
    }
  }

  return aggregiereFlowsNachTag(flows)
}

/** Gleicher Kalendertag: Beträge summieren (wie Excel/Parqet-Aggregation). */
function aggregiereFlowsNachTag(flows: IrrCashflow[]): IrrCashflow[] {
  const map = new Map<string, IrrCashflow>()
  for (const f of flows) {
    const k = f.date.toISOString().slice(0, 10)
    const cur = map.get(k)
    if (cur) {
      cur.amount = round2(cur.amount + f.amount)
    } else {
      map.set(k, { date: f.date, amount: round2(f.amount) })
    }
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Portfolio-IZF / XIRR (Parqet „Max“, Dashboard).
 *
 * Zwei Modi — abhängig vom Import:
 *
 * 1) Parqet/Depot mit Ein- & Auszahlungen (Deposit/Withdrawal in CSV):
 *    Nur Geldflüsse über die Depot-Grenze (wie Portfolio Performance / Parqet IZF).
 *    Kauf/Verkauf, Dividenden und Zinsen sind intern — nicht im IZF.
 *
 * 2) Nur Käufe/Verkäufe (z. B. TR ohne Deposit-Zeilen):
 *    Kauf = negative Einzahlung, Verkauf = positive Auszahlung, Dividende/Zins = positiver Zufluss
 *    (wie Parqet-Core `aggregateCashflowsForIrr`).
 *    Aktiendividenden/TransferIn: Parqet hat Dividend + TransferIn; TR-Import oft nur Kauf —
 *    ergänzt synthetische Dividend-Paarung (s. `irrAktiendivKontext`).
 */

import {
  dividendenZuflussEur,
  istAktiendividendeAlsKauf,
} from '@/lib/portfolio-analyse/dividenden-buchung'
import { normalisiereHandelsBuchung } from '@/lib/portfolio-analyse/parqet-handelswerte'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type IrrCashflow = { date: Date; amount: number }

export type ParqetIrrModus = 'extern' | 'handel'

export type ParqetIrrDiagnose = {
  modus: ParqetIrrModus
  anzahlFlows: number
  summeNegativEur: number
  summePositivEur: number
  ersteBuchung: string | null
  letzteBuchung: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function datumAlsDate(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Parqet-CSV / Depot mit Bank-Ein- und Auszahlungen. */
export function hatExterneDepotEinAus(buchungen: PortfolioBuchung[]): boolean {
  return buchungen.some((b) => b.typ === 'einzahlung' || b.typ === 'auszahlung')
}

function tageMitTyp(buchungen: PortfolioBuchung[], typ: PortfolioBuchung['typ']): Set<string> {
  const s = new Set<string>()
  for (const b of buchungen) {
    if (b.typ === typ) s.add(b.datum)
  }
  return s
}

export function parqetIrrModus(buchungen: PortfolioBuchung[]): ParqetIrrModus {
  return hatExterneDepotEinAus(buchungen) ? 'extern' : 'handel'
}

/** Investitionsbetrag bei Handels-Modus: Handelswert (amount), nicht Gebühr doppelt. */
export function irrBetragFuerKauf(b: PortfolioBuchung): number {
  const n = normalisiereHandelsBuchung(b)
  if (n.handelswertEur != null && n.handelswertEur > 0 && n.handelswertEur <= n.betragEur + 0.02) {
    return n.handelswertEur
  }
  return n.betragEur
}

type IrrAktiendivKontext = { paarQuote: number }

/**
 * Fehlende Parqet-Dividend-Zeile zu TransferIn (TR-Import).
 * Volle 1:1-Paarung netto 0 → IZF zu hoch; Parqet-Gewichtung bardiv / (bardiv + k·Aktiendiv).
 */
function irrAktiendivKontext(buchungen: PortfolioBuchung[]): IrrAktiendivKontext {
  let aktiendividendenGesamtEur = 0
  let bardividendenGesamtEur = 0
  for (const b of buchungen) {
    if (istAktiendividendeAlsKauf(b)) aktiendividendenGesamtEur += dividendenZuflussEur(b)
    else if (b.typ === 'dividende' || b.typ === 'zins') bardividendenGesamtEur += Math.abs(b.betragEur)
  }
  if (aktiendividendenGesamtEur <= 0 || bardividendenGesamtEur <= 0) return { paarQuote: 0 }
  const k = Math.max(1, aktiendividendenGesamtEur / bardividendenGesamtEur / 5)
  return { paarQuote: bardividendenGesamtEur / (bardividendenGesamtEur + aktiendividendenGesamtEur * k) }
}

function synthetischeDividendFuerAktiendividendeIzf(
  b: PortfolioBuchung,
  kontext: IrrAktiendivKontext,
): number {
  if (!istAktiendividendeAlsKauf(b) || kontext.paarQuote <= 0) return 0
  const brutto = dividendenZuflussEur(b)
  if (brutto <= 0) return 0
  return round2(brutto * kontext.paarQuote)
}

function flowsExtern(sortiert: PortfolioBuchung[]): IrrCashflow[] {
  const flows: IrrCashflow[] = []
  for (const b of sortiert) {
    const d = datumAlsDate(b.datum)
    if (!d) continue
    switch (b.typ) {
      case 'einzahlung':
        flows.push({ date: d, amount: -Math.abs(b.betragEur) })
        break
      case 'auszahlung':
        flows.push({ date: d, amount: Math.abs(b.betragEur) })
        break
      default:
        break
    }
  }
  return flows
}

function flowsHandel(sortiert: PortfolioBuchung[]): IrrCashflow[] {
  const tageKauf = tageMitTyp(sortiert, 'kauf')
  const tageVerkauf = tageMitTyp(sortiert, 'verkauf')
  const aktiendivKontext = irrAktiendivKontext(sortiert)
  const flows: IrrCashflow[] = []

  for (const b of sortiert) {
    const d = datumAlsDate(b.datum)
    if (!d) continue
    switch (b.typ) {
      case 'kauf': {
        flows.push({ date: d, amount: -irrBetragFuerKauf(b) })
        const paar = synthetischeDividendFuerAktiendividendeIzf(b, aktiendivKontext)
        if (paar > 0) flows.push({ date: d, amount: paar })
        break
      }
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

/** Cashflows für Portfolio-XIRR (Parqet IZF). */
export function parqetIrrCashflowsAusBuchungen(buchungen: PortfolioBuchung[]): IrrCashflow[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const roh = parqetIrrModus(sortiert) === 'extern' ? flowsExtern(sortiert) : flowsHandel(sortiert)
  return aggregiereFlowsNachTag(roh)
}

export function parqetIrrDiagnose(
  buchungen: PortfolioBuchung[],
  terminalValueEUR: number,
): ParqetIrrDiagnose {
  const flows = parqetIrrCashflowsAusBuchungen(buchungen)
  let summeNegativEur = 0
  let summePositivEur = 0
  for (const f of flows) {
    if (f.amount < 0) summeNegativEur += f.amount
    else summePositivEur += f.amount
  }
  summePositivEur += Math.max(0, terminalValueEUR)
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  return {
    modus: parqetIrrModus(buchungen),
    anzahlFlows: flows.length + (terminalValueEUR > 0 ? 1 : 0),
    summeNegativEur: round2(summeNegativEur),
    summePositivEur: round2(summePositivEur),
    ersteBuchung: sortiert[0]?.datum ?? null,
    letzteBuchung: sortiert[sortiert.length - 1]?.datum ?? null,
  }
}

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

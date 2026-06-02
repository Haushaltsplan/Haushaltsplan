/**
 * Parqet-Dashboard Hero: Kennzahlen je gewähltem Zeitraum.
 *
 * - „Wert am …“ = Portfoliowert am Periodenanfang (aus Wertentwicklung)
 * - „Investiert“ = Netto-Zufluss im Zeitraum (Einzahlungen − Auszahlungen, sonst Käufe − Verkäufe)
 * - „Kursgewinn“ = Portfoliowert_heute − Wert_am_Start − Investiert_im_Zeitraum
 * - Performance-% ≈ Kursgewinn / (Wert_am_Start + Investiert_im_Zeitraum)
 */

import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'
import { hatExterneDepotEinAus, irrBetragFuerKauf } from '@/lib/portfolio-analyse/parqet-xirr'
import { buchungZaehltFuerParqetRealisiert } from '@/lib/portfolio-analyse/parqet-realisiert'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type ParqetPeriodKennzahlen = {
  periodKey: PeriodPerformance['periodKey']
  periodStartDatumIso: string
  portfoliowertHeute: number
  wertAmPeriodenstart: number
  investiertImZeitraum: number
  kursgewinn: number
  performanceProzent: number | null
  dividendenImZeitraum: number
  realisiertImZeitraum: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/** Kalender-Offset wie Parqet (z. B. 3 Monate → gleicher Tag vor 3 Monaten). */
function minusKalenderMonate(heute: Date, monate: number): string {
  const d = new Date(heute)
  const tag = d.getDate()
  d.setMonth(d.getMonth() - monate)
  if (d.getDate() !== tag) d.setDate(0)
  return isoFromDate(d)
}

function minusKalenderJahre(heute: Date, jahre: number): string {
  const d = new Date(heute)
  d.setFullYear(d.getFullYear() - jahre)
  return isoFromDate(d)
}

/** Stichtag am Periodenanfang (Kalendertag, Europe-local via Date-Konstruktor). */
export function periodenStartIso(
  periodKey: PeriodPerformance['periodKey'],
  heute: string,
  ersteBuchungIso: string | null,
): string {
  const now = new Date(`${heute}T12:00:00`)
  const msDay = 86400000

  switch (periodKey) {
    case '1T':
      return isoFromDate(new Date(now.getTime() - 1 * msDay))
    case '1W':
      return isoFromDate(new Date(now.getTime() - 7 * msDay))
    case '1M':
      return minusKalenderMonate(now, 1)
    case '3M':
      return minusKalenderMonate(now, 3)
    case '6M':
      return minusKalenderMonate(now, 6)
    case 'MTD':
      return isoFromDate(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0))
    case 'YTD':
      return isoFromDate(new Date(now.getFullYear(), 0, 1, 12, 0, 0))
    case '1J':
      return minusKalenderJahre(now, 1)
    case '3J':
      return minusKalenderJahre(now, 3)
    case '5J':
      return minusKalenderJahre(now, 5)
    case 'MAX':
      return ersteBuchungIso ?? heute
    default:
      return isoFromDate(new Date(now.getTime() - 1 * msDay))
  }
}

function wertAmStichtag(wertentwicklung: WertentwicklungPunkt[], stichtagIso: string): number {
  if (wertentwicklung.length === 0) return 0

  const exakt = wertentwicklung.find((p) => p.datumIso === stichtagIso)
  if (exakt) return exakt.portfoliowertEur

  const ersterAb = wertentwicklung.find((p) => p.datumIso >= stichtagIso)
  if (ersterAb) return ersterAb.portfoliowertEur

  return wertentwicklung[0]?.portfoliowertEur ?? 0
}

/** Netto-Zufluss im offenen Intervall (start, end]. */
function nettoZuflussImZeitraum(
  buchungen: PortfolioBuchung[],
  startDatumIso: string,
  endDatumIso: string,
): number {
  const extern = hatExterneDepotEinAus(buchungen)
  let sum = 0

  for (const b of buchungen) {
    if (b.datum <= startDatumIso) continue
    if (b.datum > endDatumIso) continue

    if (extern) {
      if (b.typ === 'einzahlung') sum += b.betragEur
      else if (b.typ === 'auszahlung') sum -= b.betragEur
    } else {
      if (b.typ === 'kauf') sum += irrBetragFuerKauf(b)
      else if (b.typ === 'verkauf') sum -= b.betragEur
    }
  }

  return round2(sum)
}

function dividendenImZeitraum(
  buchungen: PortfolioBuchung[],
  startDatumIso: string,
  endDatumIso: string,
): number {
  let sum = 0
  for (const b of buchungen) {
    if (b.datum <= startDatumIso || b.datum > endDatumIso) continue
    if (b.typ === 'dividende' || b.typ === 'zins') sum += b.betragEur
  }
  return round2(sum)
}

function realisiertImZeitraum(
  buchungen: PortfolioBuchung[],
  startDatumIso: string,
  endDatumIso: string,
): number {
  let sum = 0
  let hat = false
  for (const b of buchungen) {
    if (b.datum <= startDatumIso || b.datum > endDatumIso) continue
    if (!buchungZaehltFuerParqetRealisiert(b)) continue
    sum += b.realisierterGewinnEur ?? 0
    hat = true
  }
  return hat ? round2(sum) : 0
}

export function berechneParqetPeriodKennzahlen(
  periodKey: PeriodPerformance['periodKey'],
  buchungen: PortfolioBuchung[],
  wertentwicklung: WertentwicklungPunkt[],
  portfoliowertHeute: number,
  ersteBuchungIso: string | null,
): ParqetPeriodKennzahlen {
  const heute = heuteIso()
  const startDatumIso = periodenStartIso(periodKey, heute, ersteBuchungIso)
  // Parqet „Seit Kauf“: Depotstart mit 0 €; sonst Portfoliowert am Periodenanfang.
  const wertAmPeriodenstart =
    periodKey === 'MAX' ? 0 : round2(wertAmStichtag(wertentwicklung, startDatumIso))
  const zuflussAb =
    periodKey === 'MAX' && ersteBuchungIso
      ? isoFromDate(new Date(new Date(`${ersteBuchungIso}T12:00:00`).getTime() - 86400000))
      : startDatumIso
  const investiertImZeitraum = nettoZuflussImZeitraum(buchungen, zuflussAb, heute)

  const kursgewinn = round2(portfoliowertHeute - wertAmPeriodenstart - investiertImZeitraum)

  const perfBasis = wertAmPeriodenstart + Math.max(0, investiertImZeitraum)
  const performanceProzent =
    perfBasis > 0 ? round2((kursgewinn / perfBasis) * 100) : null

  return {
    periodKey,
    periodStartDatumIso: startDatumIso,
    portfoliowertHeute: round2(portfoliowertHeute),
    wertAmPeriodenstart,
    investiertImZeitraum,
    kursgewinn,
    performanceProzent,
    dividendenImZeitraum: dividendenImZeitraum(buchungen, zuflussAb, heute),
    realisiertImZeitraum: realisiertImZeitraum(buchungen, zuflussAb, heute),
  }
}

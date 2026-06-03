/**
 * Parqet-Dashboard Hero: Kennzahlen je gewähltem Zeitraum.
 *
 * - „Wert am …“ = Portfoliowert am Periodenanfang (aus Wertentwicklung)
 * - „Investiert“ = eingesetztes Kapital (Einstand + Cash) am Stichtag – wie Parqet „zugeführt“
 * - Seit Kauf (MAX): Investiert = Kapital heute (Startwert 0 €)
 * - Alle anderen Zeiträume: Investiert = Kapital(heute) − Kapital(Periodenstart)
 * - „Kursgewinn“ = Portfoliowert_heute − Wert_am_Start − Investiert_im_Zeitraum
 * - Performance-% ≈ Kursgewinn / (Wert_am_Start + Investiert_im_Zeitraum)
 */

import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'
import { buchungZaehltFuerParqetRealisiert } from '@/lib/portfolio-analyse/parqet-realisiert'
import { depotStandBisDatum, einstandWertpapiereEur } from '@/lib/portfolio-analyse/bestand'
import { dividendenZuflussEur, istKlassischeDividende } from '@/lib/portfolio-analyse/dividenden-buchung'
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

type StichtagWert = {
  datumIso: string
  portfoliowertEur: number
}

/**
 * Parqet-artig: Wert zum Periodenstart als letzter verfügbarer Börsentag <= Stichtag.
 * Fallback nur wenn keine frühere Reihe existiert: erster Punkt nach Stichtag.
 */
function wertAmStichtag(
  wertentwicklung: WertentwicklungPunkt[],
  stichtagIso: string,
): StichtagWert {
  if (wertentwicklung.length === 0) {
    return { datumIso: stichtagIso, portfoliowertEur: 0 }
  }

  let letzterBisStichtag: WertentwicklungPunkt | null = null
  for (const p of wertentwicklung) {
    if (p.datumIso <= stichtagIso) letzterBisStichtag = p
    else break
  }
  if (letzterBisStichtag) {
    return {
      datumIso: letzterBisStichtag.datumIso,
      portfoliowertEur: letzterBisStichtag.portfoliowertEur,
    }
  }

  const ersterDanach = wertentwicklung.find((p) => p.datumIso > stichtagIso) ?? wertentwicklung[0]
  return { datumIso: ersterDanach.datumIso, portfoliowertEur: ersterDanach.portfoliowertEur }
}

/**
 * Tagesstartwert (vor Börsenbeginn) für "Heute":
 * zeigt Datum = heute, nimmt aber den letzten verfügbaren EOD-Wert < heute.
 */
function wertZumTagesstart(
  wertentwicklung: WertentwicklungPunkt[],
  heute: string,
): number {
  if (wertentwicklung.length === 0) return 0

  let letzterVorHeute: WertentwicklungPunkt | null = null
  for (const p of wertentwicklung) {
    if (p.datumIso < heute) letzterVorHeute = p
    else break
  }
  if (letzterVorHeute) return letzterVorHeute.portfoliowertEur

  const erster = wertentwicklung[0]
  return erster?.portfoliowertEur ?? 0
}

/**
 * Parqet „Investiert“ / „zugeführtes Kapital“ am Stichtag (End-of-day):
 * Einstand offener Positionen + Bargeld – nicht Brutto-Einzahlungen und nicht Käufe+Deposits doppelt.
 */
export function parqetInvestiertAmStichtag(
  buchungen: PortfolioBuchung[],
  stichtagIso: string,
): number {
  const stand = depotStandBisDatum(buchungen, stichtagIso)
  const einstand = einstandWertpapiereEur(stand)
  const cash = Math.max(0, stand.cash)
  return round2(einstand + cash)
}

/** Zusätzliches Kapital im Zeitraum = Differenz der Parqet-Investiert-Kurve. */
function investiertImZeitraumParqet(
  buchungen: PortfolioBuchung[],
  periodKey: PeriodPerformance['periodKey'],
  startDatumIso: string,
  heute: string,
): number {
  const heuteKapital = parqetInvestiertAmStichtag(buchungen, heute)
  if (periodKey === 'MAX') return heuteKapital
  const startKapital = parqetInvestiertAmStichtag(buchungen, startDatumIso)
  return round2(heuteKapital - startKapital)
}

function dividendenImZeitraum(
  buchungen: PortfolioBuchung[],
  startDatumIso: string,
  endDatumIso: string,
): number {
  const klassischAmTag = new Set<string>()
  for (const b of buchungen) {
    if (b.datum <= startDatumIso || b.datum > endDatumIso) continue
    if (!b.isin || !istKlassischeDividende(b)) continue
    klassischAmTag.add(`${b.isin.toUpperCase()}|${b.datum}`)
  }

  let sum = 0
  for (const b of buchungen) {
    if (b.datum <= startDatumIso || b.datum > endDatumIso) continue
    const zufluss = dividendenZuflussEur(b)
    if (zufluss <= 0) continue
    if (!b.isin) continue
    if (!istKlassischeDividende(b) && klassischAmTag.has(`${b.isin.toUpperCase()}|${b.datum}`)) continue
    sum += zufluss
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
  /** Live: Schlusskurs Vortag × Bestand Vortag (Parqet „Heute“). */
  portfoliowertTagesstart?: number | null,
): ParqetPeriodKennzahlen {
  const heute = heuteIso()
  const startDatumSoll = periodKey === '1T' ? heute : periodenStartIso(periodKey, heute, ersteBuchungIso)
  const startWert = periodKey === 'MAX' ? null : wertAmStichtag(wertentwicklung, startDatumSoll)
  const startDatumIso = periodKey === '1T' ? heute : (startWert?.datumIso ?? startDatumSoll)
  // Parqet „Seit Kauf“: Depotstart mit 0 €; sonst Portfoliowert am Periodenanfang.
  const wertAmPeriodenstart =
    periodKey === 'MAX'
      ? 0
      : periodKey === '1T'
        ? round2(
            portfoliowertTagesstart != null && portfoliowertTagesstart > 0
              ? portfoliowertTagesstart
              : wertZumTagesstart(wertentwicklung, heute),
          )
        : round2(startWert?.portfoliowertEur ?? 0)
  const zuflussAb =
    periodKey === 'MAX' && ersteBuchungIso
      ? isoFromDate(new Date(new Date(`${ersteBuchungIso}T12:00:00`).getTime() - 86400000))
      : startDatumIso
  const investiertImZeitraum = investiertImZeitraumParqet(
    buchungen,
    periodKey,
    startDatumIso,
    heute,
  )

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

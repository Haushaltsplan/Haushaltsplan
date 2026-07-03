/**
 * Parqet-Dashboard „Rendite“ (seit erster Buchung / MAX).
 */

import { realisierterGewinnAusVerkaeufen } from '@/lib/portfolio-analyse/depot-berechnung'
import { irrAusBuchungen } from '@/lib/portfolio-analyse/depot-berechnung'
import {
  bardividendeBruttoParqetEur,
  istGezahlteBardividende,
  PARQET_DIV_STEUERSATZ,
} from '@/lib/portfolio-analyse/dividenden-buchung'
import { gebuehrSteuerIndex, kaufEinstandBetragEur } from '@/lib/portfolio-analyse/parqet-einstand'
import {
  berechneParqetPeriodKennzahlen,
  parqetInvestiertAmStichtag,
} from '@/lib/portfolio-analyse/parqet-period-kennzahlen'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type ParqetRenditeKennzahlen = {
  portfoliowertEur: number
  investiertEur: number
  kursgewinnEur: number
  kursgewinnProzent: number | null
  realisiertBruttoEur: number
  realisiertProzent: number | null
  dividendenBruttoEur: number
  dividendenProzent: number | null
  gewinnEur: number
  steuernEur: number
  gebuehrenEur: number
  nettogewinnEur: number
  izfProzent: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function prozentVonBasis(wert: number, basis: number | null): number | null {
  if (basis == null || basis <= 0) return null
  return round2((wert / basis) * 100)
}

/** Nur gezahlte Bardividenden brutto (ohne Aktiendividende / Zinsen). */
export function summeDividendenBruttoParqet(buchungen: PortfolioBuchung[]): number {
  const heute = heuteIso()
  let sum = 0
  for (const b of buchungen) {
    if (b.datum > heute) continue
    sum += bardividendeBruttoParqetEur(b)
  }
  return round2(sum)
}

/** Spread Handelswert vs. Cash (Kauf: Betrag > HW, Verkauf: HW > Erlös). */
function handelsgebuehrAusKursSpread(b: PortfolioBuchung): number {
  if (b.typ !== 'kauf' && b.typ !== 'verkauf') return 0
  const stk = Math.abs(b.stueck ?? 0)
  if (stk <= 0 || b.kursEur == null || b.kursEur <= 0) return 0
  const hw = round2(stk * b.kursEur)
  if (b.typ === 'kauf' && b.betragEur > hw + 0.01) return round2(b.betragEur - hw)
  if (b.typ === 'verkauf' && hw > b.betragEur + 0.01) return round2(hw - b.betragEur)
  return 0
}

/** Explizite Gebühr-Zeilen + eingebettete Ordergebühren (Kauf + Verkauf). */
export function summeGebuehrenParqet(buchungen: PortfolioBuchung[]): number {
  const feeIndex = gebuehrSteuerIndex(buchungen)
  let sum = 0
  for (const b of buchungen) {
    if (b.typ === 'gebuehr') sum += b.betragEur
    else if (b.typ === 'kauf') {
      const spread = handelsgebuehrAusKursSpread(b)
      if (spread > 0) sum += spread
      else {
        const einstand = kaufEinstandBetragEur(b, feeIndex)
        if (b.betragEur > einstand + 0.01) sum += b.betragEur - einstand
      }
    } else if (b.typ === 'verkauf') {
      sum += handelsgebuehrAusKursSpread(b)
    }
  }
  return round2(sum)
}

/** Dividendensteuer (Parqet-Verhältnis) + separate Steuer-Buchungen. */
export function summeSteuernParqet(buchungen: PortfolioBuchung[]): number {
  const heute = heuteIso()
  const filtered = buchungen.filter((b) => b.datum <= heute)
  let sum = round2(summeDividendenBruttoParqet(filtered) * PARQET_DIV_STEUERSATZ)
  for (const b of filtered) {
    if (b.typ === 'steuer') sum += b.betragEur
    if (
      b.steuerEur != null &&
      b.steuerEur > 0 &&
      !istGezahlteBardividende(b)
    ) {
      sum += b.steuerEur
    }
  }
  return round2(sum)
}

export function berechneParqetRenditeKennzahlen(
  buchungen: PortfolioBuchung[],
  portfoliowertEur: number,
  wertentwicklung: WertentwicklungPunkt[],
  ersteBuchungIso: string | null,
): ParqetRenditeKennzahlen {
  const heute = heuteIso()
  const investiertEur = parqetInvestiertAmStichtag(buchungen, heute)
  const period = berechneParqetPeriodKennzahlen(
    'MAX',
    buchungen,
    wertentwicklung,
    portfoliowertEur,
    ersteBuchungIso,
  )

  const kursgewinnEur = period.kursgewinn
  const realisiertBruttoEur = realisierterGewinnAusVerkaeufen(buchungen)
  const dividendenBruttoEur = summeDividendenBruttoParqet(buchungen)
  const steuernEur = summeSteuernParqet(buchungen)
  const gebuehrenEur = summeGebuehrenParqet(buchungen)
  const gewinnEur = round2(kursgewinnEur + realisiertBruttoEur + dividendenBruttoEur)
  const nettogewinnEur = round2(gewinnEur - steuernEur - gebuehrenEur)

  const basis = investiertEur > 0 ? investiertEur : null

  return {
    portfoliowertEur: round2(portfoliowertEur),
    investiertEur,
    kursgewinnEur,
    kursgewinnProzent: period.performanceProzent ?? prozentVonBasis(kursgewinnEur, basis),
    realisiertBruttoEur,
    realisiertProzent: prozentVonBasis(realisiertBruttoEur, basis),
    dividendenBruttoEur,
    dividendenProzent: prozentVonBasis(dividendenBruttoEur, basis),
    gewinnEur,
    steuernEur,
    gebuehrenEur,
    nettogewinnEur,
    izfProzent: irrAusBuchungen(buchungen, portfoliowertEur),
  }
}

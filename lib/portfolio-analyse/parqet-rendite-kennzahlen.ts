/**
 * Parqet-Dashboard „Rendite“ (seit erster Buchung / MAX).
 */

import { realisierterGewinnAusVerkaeufen } from '@/lib/portfolio-analyse/depot-berechnung'
import { irrAusBuchungen } from '@/lib/portfolio-analyse/depot-berechnung'
import { dividendenZuflussEur } from '@/lib/portfolio-analyse/dividenden-buchung'
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

/** Bardividenden + Zinsen + Aktiendividenden (Parqet „Dividenden brutto“). */
export function summeDividendenBruttoParqet(buchungen: PortfolioBuchung[]): number {
  const heute = heuteIso()
  let sum = 0
  for (const b of buchungen) {
    if (b.datum > heute) continue
    if (b.typ === 'zins') sum += b.betragEur
    else sum += dividendenZuflussEur(b)
  }
  return round2(sum)
}

/** Explizite Gebühr-Zeilen + eingebettete Ordergebühren in Käufen. */
export function summeGebuehrenParqet(buchungen: PortfolioBuchung[]): number {
  const feeIndex = gebuehrSteuerIndex(buchungen)
  let sum = 0
  for (const b of buchungen) {
    if (b.typ === 'gebuehr') sum += b.betragEur
    else if (b.typ === 'kauf') {
      const einstand = kaufEinstandBetragEur(b, feeIndex)
      if (b.betragEur > einstand + 0.01) sum += b.betragEur - einstand
    }
  }
  return round2(sum)
}

/** Steuer-Zeilen + importierte steuerEur (z. B. Dividenden-PDF). */
export function summeSteuernParqet(buchungen: PortfolioBuchung[]): number {
  let sum = 0
  for (const b of buchungen) {
    if (b.typ === 'steuer') sum += b.betragEur
    if (b.steuerEur != null && b.steuerEur > 0) sum += b.steuerEur
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

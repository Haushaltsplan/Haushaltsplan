/** Dividenden-Historie & Wachstumsstatistik aus DivvyDiary. */

import 'server-only'

import { cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { adaptiverCagr } from '@/lib/portfolio-analyse/fundamentaldaten-scorecard-horizont'
import type { DividendenHistorieStat } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import {
  dividendenHistoriePlausibel,
  ladeDivvydiaryRohdaten,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

type DivRow = { exDate: string; amount: number; forecast: boolean }
type JahresSumme = { jahr: number; summe: number; zahlungen: number }

/** Kleine Toleranz für Rundung / FX-Rauschen — kein echter Dividenden-Cut. */
const SENKUNG_TOLERANZ = 0.995

function jahresSummen(rows: DivRow[]): JahresSumme[] {
  const map = new Map<number, { summe: number; zahlungen: number }>()
  for (const r of rows) {
    if (r.forecast) continue
    const jahr = parseInt(r.exDate.slice(0, 4), 10)
    const prev = map.get(jahr) ?? { summe: 0, zahlungen: 0 }
    prev.summe += r.amount
    prev.zahlungen += 1
    map.set(jahr, prev)
  }
  return [...map.entries()]
    .map(([jahr, v]) => ({ jahr, summe: v.summe, zahlungen: v.zahlungen }))
    .sort((a, b) => a.jahr - b.jahr)
}

/**
 * Nur vollständige Geschäftsjahre für YoY-Vergleiche.
 * Laufendes Kalenderjahr und Jahre mit zu wenigen Zahlungen (YTD) werden ausgeschlossen.
 */
function jahreFuerSenkungVergleich(jahre: JahresSumme[], heuteIso: string): JahresSumme[] {
  const aktJahr = parseInt(heuteIso.slice(0, 4), 10)
  return jahre.filter((j) => {
    if (j.jahr >= aktJahr) return false
    const vorjahr = jahre.find((x) => x.jahr === j.jahr - 1)
    if (vorjahr && vorjahr.zahlungen >= 2 && j.zahlungen < vorjahr.zahlungen) return false
    return j.zahlungen > 0
  })
}

function istSenkung(vorjahrSumme: number, jahrSumme: number): boolean {
  return jahrSumme < vorjahrSumme * SENKUNG_TOLERANZ
}

function jahreOhneSenkung(jahre: JahresSumme[]): { streak: number; letzteSenkung: number | null } {
  if (jahre.length === 0) return { streak: 0, letzteSenkung: null }
  if (jahre.length === 1) return { streak: 1, letzteSenkung: null }

  let letzteSenkung: number | null = null
  for (let i = jahre.length - 1; i >= 1; i--) {
    if (istSenkung(jahre[i - 1]!.summe, jahre[i]!.summe)) {
      letzteSenkung = jahre[i]!.jahr
      break
    }
  }

  let streak = 0
  for (let i = jahre.length - 1; i >= 1; i--) {
    if (istSenkung(jahre[i - 1]!.summe, jahre[i]!.summe)) break
    streak++
  }

  return { streak: streak > 0 ? streak + 1 : 1, letzteSenkung }
}

function durchschnittWachstum(jahre: { summe: number }[], n: number): number | null {
  if (jahre.length < n + 1) return null
  const slice = jahre.slice(-(n + 1))
  const rates: number[] = []
  for (let i = 1; i < slice.length; i++) {
    const a = slice[i - 1]!.summe
    const b = slice[i]!.summe
    if (a > 0 && b > 0) rates.push(((b - a) / a) * 100)
  }
  if (rates.length === 0) return null
  return rates.reduce((s, r) => s + r, 0) / rates.length
}

export async function ladeDividendenHistorieStat(
  isin: string,
  name: string,
): Promise<DividendenHistorieStat | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10) return null

  const heute = heuteIsoUtc()
  const roh = await ladeDivvydiaryRohdaten(isinNorm, name, heute)
  if (!roh?.rows?.length) return null
  if (!dividendenHistoriePlausibel(roh.rows, roh.earnings, heute)) return null

  const real = roh.rows.filter((r) => !r.forecast)
  if (real.length === 0) return null

  const jahreAlle = jahresSummen(roh.rows)
  const jahreVergleich = jahreFuerSenkungVergleich(jahreAlle, heute)
  const { streak, letzteSenkung } = jahreOhneSenkung(jahreVergleich)
  const letzte = real[real.length - 1]!

  const cagr5 =
    jahreVergleich.length >= 6
      ? cagrProzent(
          [jahreVergleich[jahreVergleich.length - 6]!.summe, jahreVergleich[jahreVergleich.length - 1]!.summe],
          5,
        )
      : null
  const cagr10 =
    jahreVergleich.length >= 11
      ? cagrProzent(
          [jahreVergleich[jahreVergleich.length - 11]!.summe, jahreVergleich[jahreVergleich.length - 1]!.summe],
          10,
        )
      : null
  const cagrAdaptiv = adaptiverCagr(jahreVergleich.map((j) => j.summe))

  return {
    anzahlZahlungen: real.length,
    jahreMitDaten: jahreAlle.length,
    letzteExDate: letzte.exDate,
    letzteDividendeUsd: letzte.amount,
    frequenz: roh.earnings?.dividendFrequency ?? null,
    cagr5yPct: cagr5,
    cagr10yPct: cagr10,
    cagrVerfuegbarPct: cagrAdaptiv?.pct ?? null,
    cagrJahre: cagrAdaptiv?.jahre ?? null,
    jahreOhneSenkung: streak,
    letzteSenkungJahr: letzteSenkung,
    durchschnittWachstum3yPct: durchschnittWachstum(jahreVergleich, 3),
    quelle: 'divvydiary',
  }
}

/** Dividenden-Historie & Wachstumsstatistik aus DivvyDiary. */

import 'server-only'

import { cagrProzent } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { DividendenHistorieStat } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { ladeDivvydiaryRohdaten } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

function jahresSummen(
  rows: { exDate: string; amount: number; forecast: boolean }[],
): { jahr: number; summe: number; istPrognose: boolean }[] {
  const map = new Map<number, { summe: number; prognose: boolean }>()
  for (const r of rows) {
    if (r.forecast) continue
    const jahr = parseInt(r.exDate.slice(0, 4), 10)
    const prev = map.get(jahr) ?? { summe: 0, prognose: false }
    prev.summe += r.amount
    map.set(jahr, prev)
  }
  return [...map.entries()]
    .map(([jahr, v]) => ({ jahr, summe: v.summe, istPrognose: v.prognose }))
    .sort((a, b) => a.jahr - b.jahr)
}

function jahreOhneSenkung(jahre: { jahr: number; summe: number }[]): { streak: number; letzteSenkung: number | null } {
  if (jahre.length < 2) return { streak: jahre.length, letzteSenkung: null }
  let streak = 0
  let letzteSenkung: number | null = null
  for (let i = jahre.length - 1; i >= 1; i--) {
    const cur = jahre[i]!
    const prev = jahre[i - 1]!
    if (cur.summe >= prev.summe * 0.995) streak++
    else {
      letzteSenkung = cur.jahr
      break
    }
  }
  if (letzteSenkung == null) {
    for (let i = 1; i < jahre.length; i++) {
      if (jahre[i]!.summe < jahre[i - 1]!.summe * 0.995) {
        letzteSenkung = jahre[i]!.jahr
        break
      }
    }
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

  const roh = await ladeDivvydiaryRohdaten(isinNorm, name, heuteIsoUtc())
  if (!roh?.rows?.length) return null

  const real = roh.rows.filter((r) => !r.forecast)
  if (real.length === 0) return null

  const jahre = jahresSummen(roh.rows)
  const { streak, letzteSenkung } = jahreOhneSenkung(jahre)
  const letzte = real[real.length - 1]!

  const cagr5 =
    jahre.length >= 6
      ? cagrProzent(
          [jahre[jahre.length - 6]!.summe, jahre[jahre.length - 1]!.summe],
          5,
        )
      : null
  const cagr10 =
    jahre.length >= 11
      ? cagrProzent(
          [jahre[jahre.length - 11]!.summe, jahre[jahre.length - 1]!.summe],
          10,
        )
      : null

  return {
    anzahlZahlungen: real.length,
    jahreMitDaten: jahre.length,
    letzteExDate: letzte.exDate,
    letzteDividendeUsd: letzte.amount,
    frequenz: roh.earnings?.dividendFrequency ?? null,
    cagr5yPct: cagr5,
    cagr10yPct: cagr10,
    jahreOhneSenkung: streak,
    letzteSenkungJahr: letzteSenkung,
    durchschnittWachstum3yPct: durchschnittWachstum(jahre, 3),
    quelle: 'divvydiary',
  }
}

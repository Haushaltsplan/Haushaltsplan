/** Yahoo- und Stooq-Serien zusammenführen (mehr Handelstage / Fallback). */

import { stooqHistorieKey, yahooZuStooqSymbol } from '@/lib/portfolio-analyse/stooq-historie-server'

export function mergeKursHistorie(
  primaer: Map<string, Map<string, number>>,
  fallback: Map<string, Map<string, number>>,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()

  for (const [sym, serie] of primaer) {
    out.set(sym, new Map(serie))
  }

  for (const [sym, serie] of fallback) {
    const existing = out.get(sym)
    if (!existing) {
      out.set(sym, new Map(serie))
      continue
    }
    for (const [tag, kurs] of serie) {
      if (!existing.has(tag)) existing.set(tag, kurs)
    }
  }

  return out
}

/** Stooq-Lücken unter Yahoo-Symbol-Keys auffüllen (für Wertentwicklung-Lookup). */
export function mergeKursHistorieMitStooqAliase(
  yahooMap: Map<string, Map<string, number>>,
  stooqMap: Map<string, Map<string, number>>,
  yahooSymbols: string[],
): Map<string, Map<string, number>> {
  const out = mergeKursHistorie(yahooMap, stooqMap)

  for (const raw of yahooSymbols) {
    const yahooKey = raw.trim().toUpperCase()
    if (!yahooKey || yahooKey.startsWith('STOOQ:')) continue

    const st = yahooZuStooqSymbol(yahooKey)
    if (!st) continue

    const stooqSerie = out.get(stooqHistorieKey(st))
    if (!stooqSerie?.size) continue

    let yahooSerie = out.get(yahooKey)
    if (!yahooSerie) {
      yahooSerie = new Map()
      out.set(yahooKey, yahooSerie)
    }

    for (const [tag, kurs] of stooqSerie) {
      if (!yahooSerie.has(tag)) yahooSerie.set(tag, kurs)
    }

    if (yahooSerie.size < stooqSerie.size * 0.55) {
      for (const [tag, kurs] of stooqSerie) yahooSerie.set(tag, kurs)
    }
  }

  return out
}

/** Pro Symbol die Serie mit mehr gültigen Tageskursen. */
export function waehleReichereSerie(
  a: Map<string, number> | undefined,
  b: Map<string, number> | undefined,
): Map<string, number> {
  const sizeA = a?.size ?? 0
  const sizeB = b?.size ?? 0
  if (sizeB > sizeA) return new Map(b!)
  if (sizeA > 0) return new Map(a!)
  return new Map()
}

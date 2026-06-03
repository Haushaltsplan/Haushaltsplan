/** Yahoo- und Stooq-Serien zusammenführen (mehr Handelstage / Fallback). */

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

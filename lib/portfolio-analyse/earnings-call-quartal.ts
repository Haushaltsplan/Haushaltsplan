/** Quartal aus Titel/Datum ableiten. */

export type QuartalInfo = {
  id: string
  jahr: number
  quartal: 1 | 2 | 3 | 4
  label: string
}

const Q_PATTERNS = [
  /\bq\s*([1-4])\s*[-_/]?\s*(?:fy)?\s*['']?(\d{2,4})\b/i,
  /\b([1-4])(?:st|nd|rd|th)?\s*quarter\s*(?:fy)?\s*['']?(\d{2,4})\b/i,
  /\bquarter\s*([1-4])\s*(?:fy)?\s*['']?(\d{2,4})\b/i,
  /\bQ([1-4])[-_\s]?(\d{4})\b/,
  /\bFY\s*(\d{4})\s*Q\s*([1-4])\b/i,
  /\bH1\s*(\d{4})\b/i,
  /\bH2\s*(\d{4})\b/i,
]

function jahrAusZweistellig(y: string): number {
  const n = Number.parseInt(y, 10)
  if (n >= 100) return n
  return n >= 70 ? 1900 + n : 2000 + n
}

export function parseQuartalAusText(titel: string, datumIso?: string | null): QuartalInfo | null {
  let text = titel.trim()
  try {
    text = decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    /* raw lassen */
  }
  // Dateinamen: unknown--Q1-2026.pdf → Q1-2026
  text = text.replace(/\.pdf$/i, ' ').replace(/[_-]+/g, ' ')

  for (const re of Q_PATTERNS) {
    const m = text.match(re)
    if (!m) continue
    if (/^H1/i.test(m[0])) {
      const jahr = Number(m[1])
      return { id: `${jahr}-Q2`, jahr, quartal: 2, label: `H1 ${jahr}` }
    }
    if (/^H2/i.test(m[0])) {
      const jahr = Number(m[1])
      return { id: `${jahr}-Q4`, jahr, quartal: 4, label: `H2 ${jahr}` }
    }
    // FY2026Q1: Gruppe 1 = Jahr, Gruppe 2 = Q
    if (/^FY/i.test(m[0]) && m[2]) {
      const jahr = jahrAusZweistellig(m[1]!)
      const q = Number(m[2]) as 1 | 2 | 3 | 4
      if (q >= 1 && q <= 4 && jahr > 1990 && jahr < 2100) {
        return { id: `${jahr}-Q${q}`, jahr, quartal: q, label: `Q${q} ${jahr}` }
      }
      continue
    }
    const q = Number(m[1]) as 1 | 2 | 3 | 4
    const jahr = jahrAusZweistellig(m[2]!)
    if (q >= 1 && q <= 4 && jahr > 1990 && jahr < 2100) {
      return { id: `${jahr}-Q${q}`, jahr, quartal: q, label: `Q${q} ${jahr}` }
    }
  }

  if (datumIso) {
    const d = new Date(datumIso)
    if (!Number.isNaN(d.getTime())) {
      const jahr = d.getUTCFullYear()
      const monat = d.getUTCMonth() + 1
      const quartal = (Math.ceil(monat / 3) || 1) as 1 | 2 | 3 | 4
      return { id: `${jahr}-Q${quartal}`, jahr, quartal, label: `Q${quartal} ${jahr}` }
    }
  }
  return null
}

export function quartalId(info: Pick<QuartalInfo, 'jahr' | 'quartal'>): string {
  return `${info.jahr}-Q${info.quartal}`
}

export function sortiereQuartale<T extends { jahr: number; quartal: number; callDatum?: string | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    if (a.jahr !== b.jahr) return b.jahr - a.jahr
    if (a.quartal !== b.quartal) return b.quartal - a.quartal
    const da = a.callDatum ? Date.parse(a.callDatum) : 0
    const db = b.callDatum ? Date.parse(b.callDatum) : 0
    return db - da
  })
}

export function gruppiereNachJahr<T extends { jahr: number }>(
  list: T[],
): { jahr: number; eintraege: T[] }[] {
  const map = new Map<number, T[]>()
  for (const e of list) {
    const arr = map.get(e.jahr) ?? []
    arr.push(e)
    map.set(e.jahr, arr)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([jahr, eintraege]) => ({ jahr, eintraege }))
}

/** Kalendertage & Achsenbeschriftung für tägliche Wertentwicklung. */

export function heuteIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const tag = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${tag}`
}

/** Alle Kalendertage von–bis inkl. (ISO YYYY-MM-DD). */
export function alleKalendertage(vonIso: string, bisIso: string): string[] {
  const [y0, m0, d0] = vonIso.split('-').map(Number)
  const [y1, m1, d1] = bisIso.split('-').map(Number)
  const cur = new Date(y0, m0 - 1, d0)
  const end = new Date(y1, m1 - 1, d1)
  const out: string[] = []
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function tagLabel(datumIso: string): string {
  const d = new Date(`${datumIso}T12:00:00`)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

/** Parqet-ähnliche X-Achsen-Marken (~10 Stück über die ganze Spanne). */
export function achsenLabelIndizes(daten: string[], maxLabels = 10): Set<number> {
  const n = daten.length
  if (n === 0) return new Set()
  if (n <= maxLabels) return new Set(daten.map((_, i) => i))

  const set = new Set<number>([0, n - 1])
  for (let i = 0; i < n; i++) {
    const tag = daten[i]
    const monat = tag.slice(5, 7)
    const day = tag.slice(8, 10)
    if (day === '01' && ['01', '04', '07', '10'].includes(monat)) set.add(i)
  }
  let k = 1
  while (set.size < maxLabels && k < maxLabels * 4) {
    for (let j = 1; j < maxLabels - 1; j++) {
      set.add(Math.round((j * (n - 1)) / (maxLabels - 1)))
    }
    k++
  }
  return set
}

/** Forward-Fill: letzter Schlusskurs mit Datum ≤ Tag (LOCF, kein Backward-Fill aus der Zukunft). */
export function forwardFillKurse(serie: Map<string, number>, tage: string[]): number[] {
  const keys = [...serie.keys()].sort()
  if (keys.length === 0) return tage.map(() => NaN)

  const out: number[] = []
  let j = 0
  let last = NaN

  for (const tag of tage) {
    while (j < keys.length && keys[j] <= tag) {
      const v = serie.get(keys[j])
      if (v != null && Number.isFinite(v) && v > 0) last = v
      j++
    }
    out.push(last)
  }
  return out
}

/** Trägt den letzten gültigen Wert nach vorne (Schutz vor API-Lücken / Wochenenden). */
export function loecfWerte(werte: number[]): number[] {
  const out = [...werte]
  let last = NaN
  for (let i = 0; i < out.length; i++) {
    const v = out[i]
    if (Number.isFinite(v) && v > 0) {
      last = v
      out[i] = v
    } else if (Number.isFinite(last) && last > 0) {
      out[i] = last
    }
  }
  return out
}

/** Forward- und Backward-Fill für lückenhafte Yahoo-Serien (ganzer Zeitraum ab erstem Kurs). */
export function forwardFillKurseBidirektional(serie: Map<string, number>, tage: string[]): number[] {
  const roh = forwardFillKurse(serie, tage)
  let naechster = NaN
  for (let i = roh.length - 1; i >= 0; i--) {
    if (Number.isFinite(roh[i]) && roh[i] > 0) naechster = roh[i]
    else if (Number.isFinite(naechster)) roh[i] = naechster
  }
  return roh
}

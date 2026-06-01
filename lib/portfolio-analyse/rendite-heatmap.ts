/** Monatliche Rendite-Heatmap (Jahre × Monate), Parqet-ähnlich. */

const MONAT_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'] as const

export type RenditeHeatmapZelle = {
  monatKey: string
  prozent: number | null
}

export type RenditeHeatmapZeile = {
  jahr: number
  gesamtProzent: number | null
  monate: (number | null)[]
}

export type RenditeHeatmap = {
  spalten: readonly string[]
  zeilen: RenditeHeatmapZeile[]
  minProzent: number
  maxProzent: number
}

/** Monatsrenditen aus aufeinanderfolgenden Depotwerten (monatlich). */
export function monatsrenditenMap(verlauf: { monat: string; wert: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 1; i < verlauf.length; i++) {
    const prev = verlauf[i - 1].wert
    const cur = verlauf[i].wert
    const key = verlauf[i].monat
    if (!key || prev <= 0) continue
    map.set(key, Math.round(((cur - prev) / prev) * 10000) / 100)
  }
  return map
}

function jahresGesamt(monate: (number | null)[]): number | null {
  const vals = monate.filter((v): v is number => v != null)
  if (vals.length === 0) return null
  let prod = 1
  for (const r of vals) prod *= 1 + r / 100
  return Math.round((prod - 1) * 10000) / 100
}

export function berechneRenditeHeatmap(
  verlauf: { monat: string; wert: number }[],
  bisJahr?: number,
): RenditeHeatmap {
  const renditen = monatsrenditenMap(verlauf)
  const jahreSet = new Set<number>()
  for (const k of renditen.keys()) {
    const y = Number(k.slice(0, 4))
    if (Number.isFinite(y)) jahreSet.add(y)
  }
  if (verlauf.length > 0) {
    const last = verlauf[verlauf.length - 1].monat
    const y = Number(last.slice(0, 4))
    if (Number.isFinite(y)) jahreSet.add(y)
  }

  const jetzt = bisJahr ?? new Date().getFullYear()
  const jahre = [...jahreSet].filter((y) => y <= jetzt).sort((a, b) => b - a)
  if (jahre.length === 0) {
    return { spalten: ['Gesamt', ...MONAT_KURZ], zeilen: [], minProzent: 0, maxProzent: 0 }
  }

  let minProzent = 0
  let maxProzent = 0

  const zeilen: RenditeHeatmapZeile[] = jahre.map((jahr) => {
    const monate: (number | null)[] = []
    const aktuellerMonat =
      jahr === jetzt ? new Date().getMonth() : 11

    for (let mo = 0; mo < 12; mo++) {
      const key = `${jahr}-${String(mo + 1).padStart(2, '0')}`
      if (jahr === jetzt && mo > aktuellerMonat) {
        monate.push(null)
        continue
      }
      const v = renditen.get(key) ?? null
      monate.push(v)
      if (v != null) {
        minProzent = Math.min(minProzent, v)
        maxProzent = Math.max(maxProzent, v)
      }
    }
    const gesamt = jahresGesamt(monate)
    if (gesamt != null) {
      minProzent = Math.min(minProzent, gesamt)
      maxProzent = Math.max(maxProzent, gesamt)
    }
    return { jahr, gesamtProzent: gesamt, monate }
  })

  return {
    spalten: ['Gesamt', ...MONAT_KURZ],
    zeilen,
    minProzent,
    maxProzent,
  }
}

/** Quartalsaggregation (Q/M-Umschalter). */
export function renditeHeatmapQuartalsweise(monatsMap: Map<string, number>): RenditeHeatmap {
  const quartalMap = new Map<string, number>()
  for (const [key, pct] of monatsMap) {
    const [y, mo] = key.split('-').map(Number)
    const q = Math.ceil(mo / 3)
    const qKey = `${y}-Q${q}`
    const prev = quartalMap.get(qKey)
    if (prev == null) quartalMap.set(qKey, pct)
    else quartalMap.set(qKey, Math.round(((1 + prev / 100) * (1 + pct / 100) - 1) * 10000) / 100)
  }

  const jahre = [...new Set([...quartalMap.keys()].map((k) => Number(k.slice(0, 4))))].sort((a, b) => b - a)
  const spalten = ['Gesamt', 'Q1', 'Q2', 'Q3', 'Q4'] as const
  let minProzent = 0
  let maxProzent = 0

  const zeilen = jahre.map((jahr) => {
    const monate: (number | null)[] = []
    for (let q = 1; q <= 4; q++) {
      const v = quartalMap.get(`${jahr}-Q${q}`) ?? null
      monate.push(v)
      if (v != null) {
        minProzent = Math.min(minProzent, v)
        maxProzent = Math.max(maxProzent, v)
      }
    }
    const gesamt = jahresGesamt(monate)
    if (gesamt != null) {
      minProzent = Math.min(minProzent, gesamt)
      maxProzent = Math.max(maxProzent, gesamt)
    }
    return { jahr, gesamtProzent: gesamt, monate }
  })

  return { spalten: [...spalten], zeilen, minProzent, maxProzent }
}

export function heatmapAusVerlauf(
  verlauf: { monat: string; wert: number }[],
  modus: 'M' | 'Q',
): RenditeHeatmap {
  const monatsMap = monatsrenditenMap(verlauf)
  if (modus === 'Q') return renditeHeatmapQuartalsweise(monatsMap)
  return berechneRenditeHeatmap(verlauf)
}

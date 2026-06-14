/** Kapitalfluss-Heatmap: Netto aus Käufen (− Verkäufe) pro Monat/Quartal — wie Parqet. */

import { irrBetragFuerKauf } from '@/lib/portfolio-analyse/parqet-xirr'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

const MONAT_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'] as const

export type KapitalflussHeatmapZeile = {
  jahr: number
  gesamtEur: number | null
  durchschnittEur: number | null
  monate: (number | null)[]
}

export type KapitalflussSummenZeile = {
  gesamtEur: number | null
  durchschnittEur: number | null
  monate: (number | null)[]
}

export type KapitalflussHeatmap = {
  spalten: readonly string[]
  zeilen: KapitalflussHeatmapZeile[]
  summen: KapitalflussSummenZeile | null
  minEur: number
  maxEur: number
}

function monatsKey(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function kapitalflussBetrag(b: PortfolioBuchung): number {
  if (b.typ === 'kauf') return irrBetragFuerKauf(b)
  if (b.typ === 'verkauf') return Math.abs(b.betragEur)
  return 0
}

/** Netto-Kapitalfluss: Käufe minus Verkäufe (Kapitalzufluss positiv, wie Parqet). */
export function kapitalflussNettoMap(buchungen: PortfolioBuchung[]): Map<string, number> {
  const kauf = new Map<string, number>()
  const verkauf = new Map<string, number>()
  for (const b of buchungen) {
    const k = monatsKey(b.datum)
    if (!k) continue
    const betrag = kapitalflussBetrag(b)
    if (betrag <= 0) continue
    if (b.typ === 'kauf') kauf.set(k, (kauf.get(k) ?? 0) + betrag)
    if (b.typ === 'verkauf') verkauf.set(k, (verkauf.get(k) ?? 0) + betrag)
  }
  const keys = new Set([...kauf.keys(), ...verkauf.keys()])
  const out = new Map<string, number>()
  for (const key of keys) {
    out.set(key, round2((kauf.get(key) ?? 0) - (verkauf.get(key) ?? 0)))
  }
  return out
}

function durchschnittMonat(monate: (number | null)[]): number | null {
  const vals = monate.filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return round2(vals.reduce((a, b) => a + b, 0) / vals.length)
}

function summeNullable(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return round2(nums.reduce((a, b) => a + b, 0))
}

function aggregateQuartale(monatsMap: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [key, netto] of monatsMap) {
    const [y, mo] = key.split('-').map(Number)
    const q = Math.ceil(mo / 3)
    const qKey = `${y}-Q${q}`
    out.set(qKey, round2((out.get(qKey) ?? 0) + netto))
  }
  return out
}

function zeilenAusMap(
  flussMap: Map<string, number>,
  modus: 'M' | 'Q',
  bisJahr?: number,
): { zeilen: KapitalflussHeatmapZeile[]; minEur: number; maxEur: number } {
  const jahreSet = new Set<number>()
  for (const k of flussMap.keys()) {
    const y = Number(k.slice(0, 4))
    if (Number.isFinite(y)) jahreSet.add(y)
  }
  const jetzt = bisJahr ?? new Date().getFullYear()
  const jahre = [...jahreSet].filter((y) => y <= jetzt).sort((a, b) => b - a)

  let minEur = 0
  let maxEur = 0

  const zeilen: KapitalflussHeatmapZeile[] = jahre.map((jahr) => {
    const monate: (number | null)[] = []
    const aktuellerMonat = jahr === jetzt ? new Date().getMonth() : 11

    if (modus === 'M') {
      for (let mo = 0; mo < 12; mo++) {
        if (jahr === jetzt && mo > aktuellerMonat) {
          monate.push(null)
          continue
        }
        const key = `${jahr}-${String(mo + 1).padStart(2, '0')}`
        const val = flussMap.get(key) ?? 0
        monate.push(val)
        minEur = Math.min(minEur, val)
        maxEur = Math.max(maxEur, val)
      }
    } else {
      for (let q = 1; q <= 4; q++) {
        const key = `${jahr}-Q${q}`
        const v = flussMap.get(key)
        if (v == null && jahr === jetzt && q > Math.ceil((aktuellerMonat + 1) / 3)) {
          monate.push(null)
        } else {
          const val = v ?? 0
          monate.push(val)
          minEur = Math.min(minEur, val)
          maxEur = Math.max(maxEur, val)
        }
      }
    }

    const gesamt = summeNullable(monate)
    if (gesamt != null) {
      minEur = Math.min(minEur, gesamt)
      maxEur = Math.max(maxEur, gesamt)
    }
    const durchschnitt = durchschnittMonat(monate)

    return { jahr, gesamtEur: gesamt, durchschnittEur: durchschnitt, monate }
  })

  return { zeilen, minEur, maxEur }
}

function summenZeile(zeilen: KapitalflussHeatmapZeile[]): KapitalflussSummenZeile | null {
  if (zeilen.length === 0) return null
  const gesamtCols = zeilen.map((z) => z.gesamtEur)
  const avgCols = zeilen.map((z) => z.durchschnittEur)
  const monatCount = zeilen[0]?.monate.length ?? 0
  const monateCols: (number | null)[] = []
  for (let i = 0; i < monatCount; i++) {
    monateCols.push(summeNullable(zeilen.map((z) => z.monate[i] ?? null)))
  }
  return {
    gesamtEur: summeNullable(gesamtCols),
    durchschnittEur: summeNullable(avgCols),
    monate: monateCols,
  }
}

export function berechneKapitalflussHeatmap(
  buchungen: PortfolioBuchung[],
  modus: 'M' | 'Q' = 'M',
): KapitalflussHeatmap {
  const monatsMap = kapitalflussNettoMap(buchungen)
  const flussMap = modus === 'Q' ? aggregateQuartale(monatsMap) : monatsMap
  const spalten =
    modus === 'M' ? (['Gesamt', 'Ø', ...MONAT_KURZ] as const) : (['Gesamt', 'Ø', 'Q1', 'Q2', 'Q3', 'Q4'] as const)

  let { zeilen, minEur, maxEur } = zeilenAusMap(flussMap, modus)
  const summen = summenZeile(zeilen)

  if (summen) {
    for (const v of [summen.gesamtEur, summen.durchschnittEur, ...summen.monate]) {
      if (v != null) {
        minEur = Math.min(minEur, v)
        maxEur = Math.max(maxEur, v)
      }
    }
  }

  return { spalten, zeilen, summen, minEur, maxEur }
}

/** Monatliche Rendite-Heatmap (Jahre × Monate), Parqet „Rendite Details“. */

import { berechnePerformanceZeitreihe } from '@/lib/portfolio-analyse/performance-zeitreihe'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'

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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Monatliche TTWROR-Renditen aus der Performance-Zeitreihe (wie Parqet Rendite-Details).
 * Tagesrenditen werden pro Kalendermonat aufgezinst.
 */
export function twrMonatsrenditenMap(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
): Map<string, number> {
  const performance = berechnePerformanceZeitreihe(wertentwicklung, buchungen, true)
  const map = new Map<string, number>()
  if (performance.length < 2) return map

  const monatsProd = new Map<string, number>()

  for (let i = 1; i < performance.length; i++) {
    const startMult = 1 + performance[i - 1].performanceProzent / 100
    const endMult = 1 + performance[i].performanceProzent / 100
    if (startMult <= 0) continue
    const month = performance[i].datumIso.slice(0, 7)
    monatsProd.set(month, (monatsProd.get(month) ?? 1) * (endMult / startMult))
  }

  for (const [month, prod] of monatsProd) {
    map.set(month, round2((prod - 1) * 100))
  }
  return map
}

function jahresGesamt(monate: (number | null)[]): number | null {
  const vals = monate.filter((v): v is number => v != null)
  if (vals.length === 0) return null
  let prod = 1
  for (const r of vals) prod *= 1 + r / 100
  return round2((prod - 1) * 100)
}

function jahreSpanne(wertentwicklung: WertentwicklungPunkt[], buchungen: PortfolioBuchung[]): number[] {
  const jahreSet = new Set<number>()
  for (const p of wertentwicklung) {
    const y = Number(p.monat.slice(0, 4))
    if (Number.isFinite(y)) jahreSet.add(y)
  }
  for (const b of buchungen) {
    const y = Number(b.datum.slice(0, 4))
    if (Number.isFinite(y)) jahreSet.add(y)
  }
  const jetzt = new Date().getFullYear()
  jahreSet.add(jetzt)
  if (jahreSet.size === 0) return []
  const min = Math.min(...jahreSet)
  const max = Math.max(jetzt, ...jahreSet)
  const out: number[] = []
  for (let y = max; y >= min; y--) out.push(y)
  return out
}

function ersterMonatMitDaten(renditen: Map<string, number>, wertentwicklung: WertentwicklungPunkt[]): string | null {
  const keys = [
    ...renditen.keys(),
    ...wertentwicklung.map((p) => p.monat),
  ].sort()
  return keys[0] ?? null
}

export function berechneRenditeHeatmap(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  renditen: Map<string, number>,
  modus: 'M' | 'Q' = 'M',
): RenditeHeatmap {
  const jahre = jahreSpanne(wertentwicklung, buchungen)
  const erster = ersterMonatMitDaten(renditen, wertentwicklung)
  const jetzt = new Date().getFullYear()
  const aktuellerMonat = new Date().getMonth()

  if (jahre.length === 0) {
    return { spalten: ['Gesamt', ...MONAT_KURZ], zeilen: [], minProzent: 0, maxProzent: 0 }
  }

  let minProzent = 0
  let maxProzent = 0

  const zeilen: RenditeHeatmapZeile[] = jahre.map((jahr) => {
    const monate: (number | null)[] = []

    if (modus === 'M') {
      for (let mo = 0; mo < 12; mo++) {
        const key = `${jahr}-${String(mo + 1).padStart(2, '0')}`
        if (jahr === jetzt && mo > aktuellerMonat) {
          monate.push(null)
          continue
        }
        if (erster && key < erster) {
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
    } else {
      for (let q = 1; q <= 4; q++) {
        let prod = 1
        let hatDaten = false
        for (let mo = (q - 1) * 3; mo < q * 3; mo++) {
          const key = `${jahr}-${String(mo + 1).padStart(2, '0')}`
          if (erster && key < erster) continue
          if (jahr === jetzt && mo > aktuellerMonat) continue
          const v = renditen.get(key)
          if (v == null) continue
          prod *= 1 + v / 100
          hatDaten = true
        }
        const qVal = hatDaten ? round2((prod - 1) * 100) : null
        monate.push(qVal)
        if (qVal != null) {
          minProzent = Math.min(minProzent, qVal)
          maxProzent = Math.max(maxProzent, qVal)
        }
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
    spalten: modus === 'Q' ? (['Gesamt', 'Q1', 'Q2', 'Q3', 'Q4'] as const) : (['Gesamt', ...MONAT_KURZ] as const),
    zeilen,
    minProzent,
    maxProzent,
  }
}

/** Parqet Rendite-Details: TTWROR aus Wertentwicklung + Buchungen. */
export function heatmapAusWertentwicklung(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  modus: 'M' | 'Q' = 'M',
): RenditeHeatmap {
  const renditen = twrMonatsrenditenMap(wertentwicklung, buchungen)
  return berechneRenditeHeatmap(wertentwicklung, buchungen, renditen, modus)
}

/** @deprecated Nutze heatmapAusWertentwicklung — reine Wertänderung ohne TTWROR. */
export function heatmapAusVerlauf(
  verlauf: { monat: string; wert: number }[],
  modus: 'M' | 'Q',
): RenditeHeatmap {
  const wertentwicklung: WertentwicklungPunkt[] = verlauf.map((p) => ({
    monat: p.monat,
    label: p.monat,
    datumIso: `${p.monat}-28`,
    portfoliowertEur: p.wert,
    zugefuehrtEur: p.wert,
    differenzEur: 0,
  }))
  return heatmapAusWertentwicklung(wertentwicklung, [], modus)
}

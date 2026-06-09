/** Aktivitäten aus HR-Verlauf erkennen (WHOOP „Aktivitäten heute“). */

import type { FitnessHrPoint } from '@/lib/fitnessdaten/types'
import type { WhoopActivity } from '@/lib/fitnessdaten/daily-records'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'

const LABELS = ['Aktivität', 'Spazieren', 'Radfahren', 'Laufen', 'Workout']

export function erkenneAktivitaeten(
  hrSeries: FitnessHrPoint[],
  restingHr: number,
  minDauerSec = 180,
  datum = heuteIsoLocal(),
): WhoopActivity[] {
  const heuteSeries = hrSeries.filter((p) => new Date(p.t).toISOString().slice(0, 10) === datum)
  if (heuteSeries.length < 5) return []

  const schwelle = restingHr + 25
  const aktiv: WhoopActivity[] = []
  let start: number | null = null
  let peak = 0
  let sum = 0
  let n = 0

  const flush = (endMs: number) => {
    if (start == null || n === 0) return
    const dauerSec = (endMs - start) / 1000
    if (dauerSec < minDauerSec) return
    const avg = sum / n
    const strain = Math.min(21, Math.round((((avg - restingHr) / 80) * dauerSec) / 60 * 10) / 10)
    const label = avg > restingHr + 40 ? LABELS[4]! : avg > restingHr + 32 ? LABELS[3]! : LABELS[1]!
    aktiv.push({
      id: `${start}-${endMs}`,
      label,
      strain: Math.max(0.5, strain),
      startMs: start,
      endMs,
      date: datum,
      avgHr: Math.round(avg),
      maxHr: peak,
    })
    start = null
    peak = 0
    sum = 0
    n = 0
  }

  for (let i = 0; i < heuteSeries.length; i++) {
    const p = heuteSeries[i]!
    if (p.bpm >= schwelle) {
      if (start == null) start = p.t
      peak = Math.max(peak, p.bpm)
      sum += p.bpm
      n++
    } else if (start != null) {
      flush(p.t)
    }
  }
  if (start != null && heuteSeries.length > 0) {
    flush(heuteSeries[heuteSeries.length - 1]!.t)
  }

  return aktiv.slice(-8)
}

export function formatUhrzeit(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function formatDauerMin(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60_000)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

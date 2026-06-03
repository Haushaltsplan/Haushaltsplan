/** Zeitreihen-Hilfen für Dashboard-Charts (Drawdown, Monatsrendite). */

import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { tagLabel } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type WertPunkt = {
  label: string
  wert: number
  monat?: string
  datumIso?: string
}

export type DrawdownPunkt = {
  label: string
  drawdownProzent: number
  monat?: string
  datumIso?: string
}

export type DrawdownStatistik = {
  serie: DrawdownPunkt[]
  maxDrawdownProzent: number
  maxDrawdownTage: number | null
  maxDrawdownPeriode: { vonLabel: string; bisLabel: string } | null
}

const MIN_PEAK_EUR = 0.01
const MAX_DRAWDOWN_PCT = -100

function labelFuerPunkt(p: WertPunkt): string {
  if (p.label.trim()) return p.label
  if (p.datumIso) return formatDatumDe(p.datumIso)
  return p.monat ?? '—'
}

function schliesseStreak(
  punkte: WertPunkt[],
  start: number,
  end: number,
  best: { len: number; start: number; end: number },
): { len: number; start: number; end: number } {
  const len = end - start + 1
  if (len > best.len) return { len, start, end }
  return best
}

function wertPunkteAusWertentwicklung(wertentwicklung: WertentwicklungPunkt[]): WertPunkt[] {
  return wertentwicklung.map((p) => ({
    label: p.label || tagLabel(p.datumIso),
    wert: p.portfoliowertEur,
    monat: p.monat,
    datumIso: p.datumIso,
  }))
}

/**
 * Drawdown nur vom Portfoliowert-Allzeithoch (nicht vom investierten Kapital).
 * Werte in [−100 %, 0 %].
 */
export function berechneDrawdown(punkte: WertPunkt[]): DrawdownStatistik
export function berechneDrawdown(wertentwicklung: WertentwicklungPunkt[]): DrawdownStatistik
export function berechneDrawdown(
  input: WertPunkt[] | WertentwicklungPunkt[],
): DrawdownStatistik {
  const punkte: WertPunkt[] =
    input.length > 0 && 'portfoliowertEur' in input[0]
      ? wertPunkteAusWertentwicklung(input as WertentwicklungPunkt[])
      : (input as WertPunkt[])

  if (punkte.length === 0) {
    return { serie: [], maxDrawdownProzent: 0, maxDrawdownTage: null, maxDrawdownPeriode: null }
  }

  let currentPeak = 0
  let maxDd = 0

  let streakStart = -1
  let best = { len: 0, start: -1, end: -1 }

  const serie: DrawdownPunkt[] = []

  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i]
    const v = Number.isFinite(p.wert) ? Math.max(0, p.wert) : 0

    if (v > currentPeak) currentPeak = v

    let drawdownProzent = 0
    if (v >= currentPeak - 1e-6) {
      drawdownProzent = 0
    } else if (currentPeak > MIN_PEAK_EUR) {
      const raw = ((v - currentPeak) / currentPeak) * 100
      drawdownProzent = Math.max(MAX_DRAWDOWN_PCT, Math.min(0, Math.round(raw * 100) / 100))
    }

    if (drawdownProzent < maxDd) maxDd = drawdownProzent

    if (drawdownProzent < 0) {
      if (streakStart < 0) streakStart = i
    } else if (streakStart >= 0) {
      best = schliesseStreak(punkte, streakStart, i - 1, best)
      streakStart = -1
    }

    serie.push({
      label: p.label,
      drawdownProzent,
      monat: p.monat,
      datumIso: p.datumIso,
    })
  }

  if (streakStart >= 0) {
    best = schliesseStreak(punkte, streakStart, punkte.length - 1, best)
  }

  let maxDrawdownTage: number | null = null
  let maxDrawdownPeriode: { vonLabel: string; bisLabel: string } | null = null

  if (best.len > 0 && best.start >= 0) {
    maxDrawdownTage = best.len
    maxDrawdownPeriode = {
      vonLabel: labelFuerPunkt(punkte[best.start]),
      bisLabel: labelFuerPunkt(punkte[best.end]),
    }
  }

  return {
    serie,
    maxDrawdownProzent: Math.max(MAX_DRAWDOWN_PCT, maxDd),
    maxDrawdownTage,
    maxDrawdownPeriode,
  }
}

export function monatsrenditenProzent(punkte: WertPunkt[]): { label: string; prozent: number; monat?: string }[] {
  if (punkte.length < 2) return []
  const out: { label: string; prozent: number; monat?: string }[] = []
  for (let i = 1; i < punkte.length; i++) {
    const prev = punkte[i - 1].wert
    const cur = punkte[i].wert
    const pct = prev > 0 ? ((cur - prev) / prev) * 100 : 0
    out.push({
      label: punkte[i].label,
      prozent: Math.round(pct * 100) / 100,
      monat: punkte[i].monat,
    })
  }
  return out
}

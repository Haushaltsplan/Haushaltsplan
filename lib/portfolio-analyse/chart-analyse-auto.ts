/**
 * Automatische Chart-Markups aus sichtbaren Datenpunkten (ViewBox-Koordinaten).
 */

import { plotZuNorm, type ChartAnalyseArt, type ChartAnalyseZeichnung } from '@/lib/portfolio-analyse/chart-analyse-store'
import type { ChartAnalysePlot, ChartAnalysePunkt } from '@/lib/portfolio-analyse/chart-analyse-store'
import { neueZeichnungId } from '@/lib/portfolio-analyse/chart-analyse-store'

export type ChartSnapPunkt = { x: number; y: number }

export const FIB_RETRACE_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
export const FIB_EXTEND_LEVELS = [1, 1.272, 1.618, 2, 2.618] as const

export type ChartAutoArt = 'support' | 'resistance' | 'fib_retrace' | 'fib_extend'

function sortiertX(pts: ChartSnapPunkt[]): ChartSnapPunkt[] {
  return [...pts].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x)
}

/** SVG: kleiner y = höherer Wert (Preis/Kennzahl oben). */
export function swingStartEnde(pts: ChartSnapPunkt[]): { start: ChartSnapPunkt; ende: ChartSnapPunkt } | null {
  const s = sortiertX(pts)
  if (s.length < 2) return null
  let hi = s[0]!
  let lo = s[0]!
  for (const p of s) {
    if (p.y < hi.y) hi = p
    if (p.y > lo.y) lo = p
  }
  if (Math.abs(hi.y - lo.y) < 0.5) return null
  if (lo.x <= hi.x) return { start: lo, ende: hi }
  return { start: hi, ende: lo }
}

function lokaleExtrema(pts: ChartSnapPunkt[], mode: 'high' | 'low'): ChartSnapPunkt[] {
  const s = sortiertX(pts)
  if (s.length < 3) return s.length ? [mode === 'high' ? s.reduce((a, p) => (p.y < a.y ? p : a)) : s.reduce((a, p) => (p.y > a.y ? p : a))] : []
  const w = Math.max(1, Math.floor(s.length / 14))
  const out: ChartSnapPunkt[] = []
  for (let i = w; i < s.length - w; i++) {
    const p = s[i]!
    let ok = true
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue
      const q = s[j]!
      if (mode === 'high' && q.y < p.y) {
        ok = false
        break
      }
      if (mode === 'low' && q.y > p.y) {
        ok = false
        break
      }
    }
    if (ok) out.push(p)
  }
  if (out.length === 0) {
    return [
      mode === 'high'
        ? s.reduce((a, p) => (p.y < a.y ? p : a))
        : s.reduce((a, p) => (p.y > a.y ? p : a)),
    ]
  }
  return out
}

function clusterY(ext: ChartSnapPunkt[], plotH: number, nachOben: boolean): { y0: number; y1: number } | null {
  if (ext.length === 0 || plotH <= 0) return null
  const sorted = [...ext].sort((a, b) => (nachOben ? a.y - b.y : b.y - a.y))
  const tol = Math.max(6, plotH * 0.035)
  const seed = sorted[0]!.y
  const gruppe = sorted.filter((p) => Math.abs(p.y - seed) <= tol * 1.6)
  const ys = gruppe.map((p) => p.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = Math.max(4, plotH * 0.018)
  return { y0: minY - pad, y1: maxY + pad }
}

function zoneZeichnung(
  art: 'support' | 'resistance',
  band: { y0: number; y1: number },
  plot: ChartAnalysePlot,
  farbe: string,
): ChartAnalyseZeichnung {
  const oben = plotZuNorm(plot, plot.padL, band.y0)
  const unten = plotZuNorm(plot, plot.viewW - plot.padR, band.y1)
  return {
    id: neueZeichnungId(),
    art,
    punkte: [
      { nx: 0, ny: Math.min(oben.ny, unten.ny) },
      { nx: 1, ny: Math.max(oben.ny, unten.ny) },
    ],
    farbe,
    text: art === 'support' ? 'Unterstützung' : 'Widerstand',
  }
}

export function baueAutoZeichnung(
  art: ChartAutoArt,
  snap: ChartSnapPunkt[],
  plot: ChartAnalysePlot,
  farbe: string,
): ChartAnalyseZeichnung | null {
  const plotH = plot.viewH - plot.padT - plot.padB
  if (art === 'support') {
    const lows = lokaleExtrema(snap, 'low')
    const band = clusterY(lows, plotH, false)
    if (!band) return null
    return zoneZeichnung('support', band, plot, '#34d399')
  }
  if (art === 'resistance') {
    const highs = lokaleExtrema(snap, 'high')
    const band = clusterY(highs, plotH, true)
    if (!band) return null
    return zoneZeichnung('resistance', band, plot, '#fb7185')
  }
  const swing = swingStartEnde(snap)
  if (!swing) return null
  const a = plotZuNorm(plot, swing.start.x, swing.start.y)
  const b = plotZuNorm(plot, swing.ende.x, swing.ende.y)
  return {
    id: neueZeichnungId(),
    art,
    punkte: [a, b],
    farbe,
    text: art === 'fib_retrace' ? 'Fib Retracement' : 'Fib Extension',
  }
}

export function autoArtErsetzt(bestehend: ChartAnalyseArt, neu: ChartAutoArt): boolean {
  return bestehend === neu || (neu === 'fib_retrace' && bestehend === 'fib')
}

export function istAutoArt(v: string): v is ChartAutoArt {
  return v === 'support' || v === 'resistance' || v === 'fib_retrace' || v === 'fib_extend'
}

export function fibLevelNy(a: ChartAnalysePunkt, b: ChartAnalysePunkt, level: number): number {
  return a.ny + (b.ny - a.ny) * level
}

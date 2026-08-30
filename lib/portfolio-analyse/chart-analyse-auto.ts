/**
 * Automatische Chart-Markups aus sichtbaren Datenpunkten (ViewBox-Koordinaten).
 * SVG: kleiner y = höherer Wert.
 */

import {
  neueZeichnungId,
  plotZuNorm,
  type ChartAnalyseArt,
  type ChartAnalysePlot,
  type ChartAnalyseZeichnung,
} from '@/lib/portfolio-analyse/chart-analyse-store'

export type ChartSnapPunkt = { x: number; y: number }

export const FIB_RETRACE_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
/** Trend-Based Extension: 0 = Punkt C, 1 = C+(B−A), danach 1.272 / 1.618 / 2 / 2.618. */
export const FIB_EXTEND_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618] as const

export type ChartAutoArt = 'support' | 'resistance' | 'sr' | 'fib_retrace' | 'fib_extend' | 'channel'

function sortiertX(pts: ChartSnapPunkt[]): ChartSnapPunkt[] {
  return [...pts].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x)
}

function ySpanne(pts: ChartSnapPunkt[]): number {
  if (pts.length === 0) return 0
  let lo = pts[0]!.y
  let hi = pts[0]!.y
  for (const p of pts) {
    if (p.y < lo) lo = p.y
    if (p.y > hi) hi = p.y
  }
  return hi - lo
}

/** Zickzack mit Mindestumkehr (Anteil der sichtbaren Y-Spanne). */
export function zigzag(pts: ChartSnapPunkt[], minUmkehrAnteil = 0.08): ChartSnapPunkt[] {
  const s = sortiertX(pts)
  if (s.length < 3) return s
  const minRev = Math.max(6, ySpanne(s) * minUmkehrAnteil)
  const pivots: ChartSnapPunkt[] = [s[0]!]
  let dir = 0
  let ext = s[0]!
  for (let i = 1; i < s.length; i++) {
    const p = s[i]!
    if (dir === 0) {
      if (Math.abs(p.y - ext.y) < minRev) continue
      dir = p.y < ext.y ? 1 : -1
      ext = p
      continue
    }
    if (dir > 0) {
      if (p.y < ext.y) ext = p
      else if (p.y - ext.y >= minRev) {
        pivots.push(ext)
        dir = -1
        ext = p
      }
    } else {
      if (p.y > ext.y) ext = p
      else if (ext.y - p.y >= minRev) {
        pivots.push(ext)
        dir = 1
        ext = p
      }
    }
  }
  const last = pivots[pivots.length - 1]
  if (!last || last.x !== ext.x || last.y !== ext.y) pivots.push(ext)
  const ende = s[s.length - 1]!
  const tail = pivots[pivots.length - 1]
  if (tail && (tail.x !== ende.x || Math.abs(tail.y - ende.y) > 1)) pivots.push(ende)
  return pivots
}

function lokaleExtrema(pts: ChartSnapPunkt[], mode: 'high' | 'low'): ChartSnapPunkt[] {
  const s = sortiertX(pts)
  if (s.length < 3) {
    if (s.length === 0) return []
    return [
      mode === 'high'
        ? s.reduce((a, p) => (p.y < a.y ? p : a))
        : s.reduce((a, p) => (p.y > a.y ? p : a)),
    ]
  }
  const w = Math.max(1, Math.floor(s.length / 22))
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
  const zz = zigzag(s, 0.07)
  for (let i = 1; i < zz.length - 1; i++) {
    const p = zz[i]!
    const prev = zz[i - 1]!
    const next = zz[i + 1]!
    if (mode === 'high' && p.y <= prev.y && p.y <= next.y) out.push(p)
    if (mode === 'low' && p.y >= prev.y && p.y >= next.y) out.push(p)
  }
  if (out.length === 0) {
    return [
      mode === 'high'
        ? s.reduce((a, p) => (p.y < a.y ? p : a))
        : s.reduce((a, p) => (p.y > a.y ? p : a)),
    ]
  }
  const uniq: ChartSnapPunkt[] = []
  for (const p of out.sort((a, b) => a.x - b.x)) {
    const last = uniq[uniq.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 4) {
      if (mode === 'high' ? p.y < last.y : p.y > last.y) uniq[uniq.length - 1] = p
      continue
    }
    uniq.push(p)
  }
  return uniq
}

type Band = { y0: number; y1: number; n: number }

function alleCluster(ext: ChartSnapPunkt[], plotH: number): Band[] {
  if (ext.length === 0 || plotH <= 0) return []
  const tol = Math.max(5, plotH * 0.028)
  const rest = [...ext].sort((a, b) => a.y - b.y)
  const clusters: Band[] = []
  while (rest.length > 0) {
    const seed = rest[0]!
    const gruppe: ChartSnapPunkt[] = []
    for (let i = rest.length - 1; i >= 0; i--) {
      if (Math.abs(rest[i]!.y - seed.y) <= tol) {
        gruppe.push(rest[i]!)
        rest.splice(i, 1)
      }
    }
    const ys = gruppe.map((p) => p.y)
    const pad = Math.max(3, plotH * (gruppe.length >= 2 ? 0.014 : 0.01))
    clusters.push({ y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad, n: gruppe.length })
  }
  clusters.sort((a, b) => b.n - a.n || a.y0 - b.y0)
  const merged: Band[] = []
  for (const c of clusters) {
    const hit = merged.find((m) => c.y0 <= m.y1 && c.y1 >= m.y0)
    if (hit) {
      hit.y0 = Math.min(hit.y0, c.y0)
      hit.y1 = Math.max(hit.y1, c.y1)
      hit.n += c.n
    } else merged.push({ ...c })
  }
  return merged.slice(0, 10)
}

function zoneZeichnung(
  art: 'support' | 'resistance',
  band: Band,
  plot: ChartAnalysePlot,
  farbe: string,
  index: number,
  gesamt: number,
): ChartAnalyseZeichnung {
  const oben = plotZuNorm(plot, plot.padL, band.y0)
  const unten = plotZuNorm(plot, plot.viewW - plot.padR, band.y1)
  const name = art === 'support' ? 'Unterstützung' : 'Widerstand'
  return {
    id: neueZeichnungId(),
    art,
    punkte: [
      { nx: 0, ny: Math.min(oben.ny, unten.ny) },
      { nx: 1, ny: Math.max(oben.ny, unten.ny) },
    ],
    farbe,
    text: gesamt > 1 ? `${name} ${index}` : name,
  }
}

function viewNorm(plot: ChartAnalysePlot, p: ChartSnapPunkt) {
  return plotZuNorm(plot, p.x, p.y)
}

function imPlot(y: number, plot: ChartAnalysePlot): boolean {
  return y >= plot.padT - 4 && y <= plot.viewH - plot.padB + 4
}

function zaehleSichtbareLevels(
  c: ChartSnapPunkt,
  dy: number,
  levels: readonly number[],
  plot: ChartAnalysePlot,
): number {
  let n = 0
  for (const lvl of levels) {
    if (imPlot(c.y + dy * lvl, plot)) n++
  }
  return n
}

/** Letzte Zickzack-Beine als Retracement (A→B). */
function retraceBeine(zz: ChartSnapPunkt[]): Array<{ a: ChartSnapPunkt; b: ChartSnapPunkt }> {
  const out: Array<{ a: ChartSnapPunkt; b: ChartSnapPunkt }> = []
  if (zz.length < 2) return out
  const last = { a: zz[zz.length - 2]!, b: zz[zz.length - 1]! }
  out.push(last)
  if (zz.length >= 4) {
    let maxAbs = 0
    let best: { a: ChartSnapPunkt; b: ChartSnapPunkt } | null = null
    for (let i = 1; i < zz.length; i++) {
      const a = zz[i - 1]!
      const b = zz[i]!
      const d = Math.abs(b.y - a.y)
      if (d > maxAbs) {
        maxAbs = d
        best = { a, b }
      }
    }
    if (best && (best.a.x !== last.a.x || best.b.x !== last.b.x) && maxAbs > Math.abs(last.b.y - last.a.y) * 1.15) {
      out.unshift(best)
    }
  }
  return out.slice(0, 2)
}

/**
 * Trend-Based Fib Extension: A Impulsstart, B Impulsende, C Retrace.
 * Level 0 = C, 1 = C+(B−A) (Measured Move).
 */
function besteAbc(zz: ChartSnapPunkt[], plot: ChartAnalysePlot): {
  a: ChartSnapPunkt
  b: ChartSnapPunkt
  c: ChartSnapPunkt
} | null {
  if (zz.length < 3) return null
  let best: { a: ChartSnapPunkt; b: ChartSnapPunkt; c: ChartSnapPunkt; score: number } | null = null
  const pruefe = (a: ChartSnapPunkt, b: ChartSnapPunkt, c: ChartSnapPunkt, recency: number) => {
    const impulse = Math.abs(b.y - a.y)
    if (impulse < 8) return
    const retrace = Math.abs(c.y - b.y)
    if (retrace < impulse * 0.12) return
    if ((c.y - b.y) * (b.y - a.y) > 0) return
    const visible = zaehleSichtbareLevels(c, b.y - a.y, FIB_EXTEND_LEVELS, plot)
    if (visible < 3) return
    const score = visible * 10 + recency * 0.4 + impulse * 0.02
    if (!best || score > best.score) best = { a, b, c, score }
  }
  for (let i = 0; i <= zz.length - 3; i++) {
    pruefe(zz[i]!, zz[i + 1]!, zz[i + 2]!, i)
  }
  const last = zz[zz.length - 1]!
  for (let i = 0; i < zz.length - 2; i++) {
    pruefe(zz[i]!, zz[i + 1]!, last, zz.length + i)
  }
  if (best) return best
  const a = zz[zz.length - 3]!
  const b = zz[zz.length - 2]!
  const c = zz[zz.length - 1]!
  if (Math.abs(b.y - a.y) < 8) return null
  if ((c.y - b.y) * (b.y - a.y) > 0) return null
  return { a, b, c }
}

function clipLinieAnPlot(
  p1: ChartSnapPunkt,
  p2: ChartSnapPunkt,
  plot: ChartAnalysePlot,
): [ChartSnapPunkt, ChartSnapPunkt] | null {
  const x0 = plot.padL
  const x1 = plot.viewW - plot.padR
  const y0 = plot.padT
  const y1 = plot.viewH - plot.padB
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  if (!clip(-dx, p1.x - x0)) return null
  if (!clip(dx, x1 - p1.x)) return null
  if (!clip(-dy, p1.y - y0)) return null
  if (!clip(dy, y1 - p1.y)) return null
  if (t0 > t1) return null
  return [
    { x: p1.x + t0 * dx, y: p1.y + t0 * dy },
    { x: p1.x + t1 * dx, y: p1.y + t1 * dy },
  ]
}

function kanalZeichnung(
  m: number,
  b1: number,
  b2: number,
  plot: ChartAnalysePlot,
  farbe: string,
  text: string,
): ChartAnalyseZeichnung | null {
  const xL = plot.padL
  const xR = plot.viewW - plot.padR
  const rail = (intercept: number) =>
    clipLinieAnPlot({ x: xL, y: m * xL + intercept }, { x: xR, y: m * xR + intercept }, plot)
  const r1 = rail(b1)
  const r2 = rail(b2)
  if (!r1 || !r2) return null
  return {
    id: neueZeichnungId(),
    art: 'channel',
    punkte: [viewNorm(plot, r1[0]), viewNorm(plot, r1[1]), viewNorm(plot, r2[0]), viewNorm(plot, r2[1])],
    farbe,
    text,
  }
}

function zweiPunktLinie(a: ChartSnapPunkt, b: ChartSnapPunkt): { m: number; intercept: number } | null {
  const dx = b.x - a.x
  if (Math.abs(dx) < 8) return null
  const m = (b.y - a.y) / dx
  if (!Number.isFinite(m) || Math.abs(m) > 4) return null
  return { m, intercept: a.y - m * a.x }
}

function kanalScore(
  m: number,
  b1: number,
  b2: number,
  pts: ChartSnapPunkt[],
  tol: number,
): number {
  let n = 0
  for (const p of pts) {
    const y1 = m * p.x + b1
    const y2 = m * p.x + b2
    if (Math.abs(p.y - y1) <= tol || Math.abs(p.y - y2) <= tol) n++
  }
  return n
}

function baueKanaele(snap: ChartSnapPunkt[], plot: ChartAnalysePlot): ChartAnalyseZeichnung[] {
  const highs = lokaleExtrema(snap, 'high')
  const lows = lokaleExtrema(snap, 'low')
  if (highs.length + lows.length < 3) return []
  const plotH = plot.viewH - plot.padT - plot.padB
  const tol = Math.max(7, plotH * 0.028)
  const minBreite = plotH * 0.045
  const kandidaten: Array<{ z: ChartAnalyseZeichnung; score: number; m: number; b1: number; b2: number }> = []

  const versuche = (anker: ChartSnapPunkt[], parallel: ChartSnapPunkt[], aufwaerts: boolean) => {
    if (anker.length < 2 || parallel.length < 1) return
    for (let i = 0; i < anker.length - 1; i++) {
      for (let j = i + 1; j < anker.length; j++) {
        const line = zweiPunktLinie(anker[i]!, anker[j]!)
        if (!line) continue
        if (aufwaerts && line.m >= -0.002) continue
        if (!aufwaerts && line.m <= 0.002) continue
        let bestB2: number | null = null
        let bestS = -1
        for (const p of parallel) {
          const intercept2 = p.y - line.m * p.x
          const breite = Math.abs(intercept2 - line.intercept) / Math.hypot(1, line.m)
          if (breite < minBreite) continue
          const s = kanalScore(line.m, line.intercept, intercept2, snap, tol)
          if (s > bestS) {
            bestS = s
            bestB2 = intercept2
          }
        }
        if (bestB2 == null || bestS < 4) continue
        const z = kanalZeichnung(
          line.m,
          line.intercept,
          bestB2,
          plot,
          aufwaerts ? '#38bdf8' : '#a78bfa',
          aufwaerts ? 'Aufwärtskanal' : 'Abwärtskanal',
        )
        if (z) kandidaten.push({ z, score: bestS, m: line.m, b1: line.intercept, b2: bestB2 })
      }
    }
  }

  versuche(lows, highs, true)
  versuche(highs, lows, false)

  kandidaten.sort((a, b) => b.score - a.score)
  const genommen: typeof kandidaten = []
  for (const k of kandidaten) {
    const dup = genommen.some(
      (o) =>
        Math.abs(o.m - k.m) < 0.04 &&
        Math.abs(o.b1 - k.b1) < plotH * 0.06 &&
        Math.abs(o.b2 - k.b2) < plotH * 0.06,
    )
    if (dup) continue
    genommen.push(k)
    if (genommen.length >= 4) break
  }
  return genommen.map((k) => k.z)
}

export function baueAutoZeichnungen(
  art: ChartAutoArt,
  snap: ChartSnapPunkt[],
  plot: ChartAnalysePlot,
  farbe: string,
): ChartAnalyseZeichnung[] {
  const plotH = plot.viewH - plot.padT - plot.padB
  if (art === 'sr') {
    return [
      ...baueAutoZeichnungen('support', snap, plot, farbe),
      ...baueAutoZeichnungen('resistance', snap, plot, farbe),
    ]
  }
  if (art === 'support') {
    const lows = lokaleExtrema(snap, 'low')
    const bands = alleCluster(lows, plotH)
    return bands.map((b, i) => zoneZeichnung('support', b, plot, '#34d399', i + 1, bands.length))
  }
  if (art === 'resistance') {
    const highs = lokaleExtrema(snap, 'high')
    const bands = alleCluster(highs, plotH)
    return bands.map((b, i) => zoneZeichnung('resistance', b, plot, '#fb7185', i + 1, bands.length))
  }
  if (art === 'channel') {
    return baueKanaele(snap, plot)
  }

  const zz = zigzag(snap, 0.075)
  if (art === 'fib_retrace') {
    const beine = retraceBeine(zz.length >= 2 ? zz : sortiertX(snap))
    return beine.map((bein, i) => ({
      id: neueZeichnungId(),
      art: 'fib_retrace' as const,
      punkte: [viewNorm(plot, bein.a), viewNorm(plot, bein.b)],
      farbe,
      text: beine.length > 1 ? `Fib Retracement ${i + 1}` : 'Fib Retracement',
    }))
  }

  const abc = besteAbc(zz, plot)
  if (!abc) return []
  return [
    {
      id: neueZeichnungId(),
      art: 'fib_extend',
      punkte: [viewNorm(plot, abc.a), viewNorm(plot, abc.b), viewNorm(plot, abc.c)],
      farbe,
      text: 'Fib Extension (A-B-C)',
    },
  ]
}

/** @deprecated nutze baueAutoZeichnungen */
export function baueAutoZeichnung(
  art: ChartAutoArt,
  snap: ChartSnapPunkt[],
  plot: ChartAnalysePlot,
  farbe: string,
): ChartAnalyseZeichnung | null {
  return baueAutoZeichnungen(art, snap, plot, farbe)[0] ?? null
}

export function autoArtErsetzt(bestehend: ChartAnalyseArt, neu: ChartAutoArt): boolean {
  if (neu === 'sr') return bestehend === 'support' || bestehend === 'resistance'
  if (bestehend === neu) return true
  if (neu === 'fib_retrace' && bestehend === 'fib') return true
  return false
}

export function istAutoArt(v: string): v is ChartAutoArt {
  return (
    v === 'support' ||
    v === 'resistance' ||
    v === 'sr' ||
    v === 'fib_retrace' ||
    v === 'fib_extend' ||
    v === 'channel'
  )
}

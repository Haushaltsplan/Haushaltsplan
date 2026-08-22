/**
 * Depot-Korrelationsmatrix & Beta-Clustering (Yahoo-Tageskurse).
 */

import 'server-only'

import { ladeYahooHistorieBatchTaeglich } from '@/lib/portfolio-analyse/yahoo-historie-server'
import type {
  BetaCluster,
  KorrelationPaar,
  PortfolioKorrelationPaket,
} from '@/lib/portfolio-analyse/portfolio-korrelation-types'

export type { BetaCluster, KorrelationPaar, PortfolioKorrelationPaket }

function isoTageZurueck(tage: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - tage)
  return d.toISOString().slice(0, 10)
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 20) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i]!
    const y = ys[i]!
    sx += x
    sy += y
    sxx += x * x
    syy += y * y
    sxy += x * y
  }
  const cov = sxy - (sx * sy) / n
  const vx = sxx - (sx * sx) / n
  const vy = syy - (sy * sy) / n
  if (vx <= 0 || vy <= 0) return null
  const r = cov / Math.sqrt(vx * vy)
  return Number.isFinite(r) ? Math.round(r * 1000) / 1000 : null
}

function returnsAusPreisen(serie: Map<string, number>): number[] {
  const sorted = [...serie.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const out: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const p0 = sorted[i - 1]![1]
    const p1 = sorted[i]![1]
    if (p0 > 0 && p1 > 0) out.push(p1 / p0 - 1)
  }
  return out
}

/** Einfaches Union-Find-Clustering bei corr ≥ schwelle. */
function clusterAusMatrix(
  ticker: string[],
  matrix: number[][],
  schwelle: number,
): BetaCluster[] {
  const parent = ticker.map((_, i) => i)
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]!)
    return parent[i]!
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  for (let i = 0; i < ticker.length; i++) {
    for (let j = i + 1; j < ticker.length; j++) {
      const c = matrix[i]![j]!
      if (c >= schwelle) unite(i, j)
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < ticker.length; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(i)
  }

  const out: BetaCluster[] = []
  let n = 1
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue
    let sum = 0
    let cnt = 0
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        sum += matrix[idxs[a]!]![idxs[b]!]!
        cnt++
      }
    }
    out.push({
      id: `c${n++}`,
      label: `Cluster ${n - 1} (corr ≥ ${schwelle})`,
      ticker: idxs.map((i) => ticker[i]!),
      avgCorr: cnt > 0 ? Math.round((sum / cnt) * 1000) / 1000 : 0,
    })
  }
  return out.sort((a, b) => b.ticker.length - a.ticker.length || b.avgCorr - a.avgCorr)
}

/**
 * Korrelationsmatrix der letzten ~1 Jahr Tagesrenditen.
 * @param betas optionale Yahoo-Betas (Ticker → Beta)
 */
export async function ladePortfolioKorrelation(opts: {
  ticker: string[]
  beta?: Record<string, number | null>
  lookbackTage?: number
}): Promise<PortfolioKorrelationPaket> {
  const ticker = [...new Set(opts.ticker.map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    40,
  )
  const leer: PortfolioKorrelationPaket = {
    ok: false,
    ticker,
    matrix: [],
    beta: opts.beta ?? {},
    hohePaare: [],
    cluster: [],
    hinweis: ticker.length < 2 ? 'Mindestens 2 Ticker nötig.' : null,
    geladenAm: new Date().toISOString(),
  }
  if (ticker.length < 2) return leer

  const bis = isoTageZurueck(1)
  const von = isoTageZurueck(opts.lookbackTage ?? 380)
  const kurse = await ladeYahooHistorieBatchTaeglich(ticker, von, bis)

  const returns = new Map<string, number[]>()
  for (const t of ticker) {
    const serie = kurse.get(t)
    if (!serie || serie.size < 40) continue
    returns.set(t, returnsAusPreisen(serie))
  }

  const valid = ticker.filter((t) => (returns.get(t)?.length ?? 0) >= 40)
  if (valid.length < 2) {
    return {
      ...leer,
      hinweis: 'Zu wenige Kursdaten für Korrelation.',
    }
  }

  const n = valid.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1))
  const hohePaare: KorrelationPaar[] = []

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ri = returns.get(valid[i]!)!
      const rj = returns.get(valid[j]!)!
      const len = Math.min(ri.length, rj.length)
      const corr = pearson(ri.slice(-len), rj.slice(-len)) ?? 0
      matrix[i]![j] = corr
      matrix[j]![i] = corr
      if (corr >= 0.7) {
        hohePaare.push({ a: valid[i]!, b: valid[j]!, corr })
      }
    }
  }

  hohePaare.sort((a, b) => b.corr - a.corr)

  return {
    ok: true,
    ticker: valid,
    matrix,
    beta: opts.beta ?? {},
    hohePaare: hohePaare.slice(0, 25),
    cluster: clusterAusMatrix(valid, matrix, 0.7),
    hinweis:
      hohePaare.length > 0
        ? `${hohePaare.length} Paare mit Korrelation ≥ 0,70 — parallele Drawdowns möglich (Volatility Drag).`
        : 'Keine extrem hohen Pair-Korrelationen (≥0,70) im 1J-Fenster.',
    geladenAm: new Date().toISOString(),
  }
}

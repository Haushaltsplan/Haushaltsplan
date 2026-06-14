/** Sichere Division — verhindert NaN/Infinity in Reports. */
export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback
  }
  const v = numerator / denominator
  return Number.isFinite(v) ? v : fallback
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function round4(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10_000) / 10_000
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseIsoDate(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}

export function annualizeReturn(totalReturn: number, days: number): number | null {
  if (days <= 0 || !Number.isFinite(totalReturn)) return null
  const years = days / 365.25
  if (years <= 0) return null
  const base = 1 + totalReturn
  if (base <= 0) return null
  const annual = Math.pow(base, 1 / years) - 1
  return Number.isFinite(annual) ? annual * 100 : null
}

export interface Cashflow {
  amountEUR: number // negativ: Käufe (Parqet: „Einzahlung“); positiv: Verkäufe, Erträge, Endwert
  timestamp: Date
}

/**
 * Annualisierter Interner Zinsfuß (IZF / XIRR) per Newton-Raphson mit analytischer Ableitung.
 * @returns Dezimalzins (z. B. 0.125 für 12,5 %); NaN bei fehlender Konvergenz
 */
export function calculateXIRR(cashflows: Cashflow[], guess = 0.1): number {
  if (cashflows.length < 2) return 0

  const sorted = [...cashflows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const d1 = sorted[0].timestamp.getTime()
  const maxIterations = 100
  const precision = 1e-6

  let r = guess

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0
    let derivativeNPV = 0

    for (const cf of sorted) {
      const t = (cf.timestamp.getTime() - d1) / (1000 * 60 * 60 * 24 * 365)
      const expTerm = Math.pow(1 + r, t)
      npv += cf.amountEUR / expTerm
      if (t > 0) {
        derivativeNPV -= (t * cf.amountEUR) / Math.pow(1 + r, t + 1)
      }
    }

    if (Math.abs(derivativeNPV) < 1e-12) {
      break
    }

    let nextR = r - npv / derivativeNPV
    if (!Number.isFinite(nextR)) break
    nextR = clamp(nextR, -0.9999, 10)

    if (Math.abs(nextR - r) < precision) {
      return nextR
    }

    r = nextR
  }

  return Number.NaN
}

/**
 * IZF als annualisierter Prozentsatz für Reports.
 * cashflows: amount negativ = Kapitalabfluss (Kauf/Einzahlung), positiv = Zufluss.
 * terminalValueEUR: fiktiver Endverkauf (aktueller Depotwert) am Stichtag.
 */
export function berechneIrrAnnualizedPercent(
  cashflows: Array<{ date: Date; amount: number }>,
  terminalValueEUR: number,
  terminalDate: Date,
): number | null {
  const cfs: Cashflow[] = cashflows.map((cf) => ({
    amountEUR: cf.amount,
    timestamp: cf.date,
  }))
  if (terminalValueEUR > 0) {
    cfs.push({ amountEUR: terminalValueEUR, timestamp: terminalDate })
  }

  if (cfs.length < 2) return null

  const hasNeg = cfs.some((f) => f.amountEUR < 0)
  const hasPos = cfs.some((f) => f.amountEUR > 0)
  if (!hasNeg || !hasPos) return null

  const guesses = [0.1, 0.05, 0.15, 0.01, -0.05, 0.25, -0.1]
  for (const g of guesses) {
    const r = calculateXIRR(cfs, g)
    if (Number.isFinite(r) && !Number.isNaN(r)) {
      return round4(r * 100)
    }
  }

  return null
}

/**
 * Gewichtete Aggregation von Prozent-Buckets (X-Ray).
 * entries: { key, label, weightPercent } mit Summe der Gewichte = 100 über Eltern-ETF.
 * parentWeightPercent = Anteil des ETFs am Gesamtportfolio.
 */
export function mergeWeightedBuckets(
  buckets: Map<string, { label: string; weight: number }>,
  entries: Array<{ key: string; label: string; percentage: number }>,
  parentWeightPercent: number,
): void {
  for (const e of entries) {
    if (!Number.isFinite(e.percentage) || e.percentage <= 0) continue
    const add = safeDiv(e.percentage * parentWeightPercent, 100, 0)
    const key = e.key.trim() || e.label
    const cur = buckets.get(key) ?? { label: e.label, weight: 0 }
    cur.weight += add
    buckets.set(key, cur)
  }
}

export function bucketsToAllocationSlices(
  buckets: Map<string, { label: string; weight: number }>,
  totalEUR: number,
): import('@/lib/portfolio-analyse/parqet-core/types').AllocationSlice[] {
  const entries = [...buckets.entries()]
    .map(([key, v]) => ({ key, label: v.label, weight: v.weight }))
    .filter((e) => e.weight > 1e-8)
    .sort((a, b) => b.weight - a.weight)

  // Gewichte sind bereits Portfolio-Anteile in % (Summe ≈ 100). Nicht auf sumW normieren —
  // sonst würden fehlende Buckets (z. B. ETF ohne Breakdown) unsichtbar hochskaliert.
  return entries.map((e) => ({
    key: e.key,
    label: e.label,
    weightPercent: round2(e.weight),
    valueEUR: round2(safeDiv(e.weight * totalEUR, 100, 0)),
  }))
}

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

/**
 * NPV für IRR: Σ CF_i / (1+r)^t_i  mit t_i in Jahren ab Start.
 * Eingänge (Investition) = negative CF, Ausgänge = positive CF.
 */
export function npv(cashflows: Array<{ tYears: number; amount: number }>, rate: number): number {
  return cashflows.reduce((sum, cf) => {
    const denom = Math.pow(1 + rate, cf.tYears)
    return sum + safeDiv(cf.amount, denom, 0)
  }, 0)
}

/**
 * IZF (IRR) per Newton-Raphson.
 * cashflows: amount negativ = Kapitalabfluss (Kauf/Einzahlung), positiv = Zufluss.
 */
export function berechneIrrAnnualizedPercent(
  cashflows: Array<{ date: Date; amount: number }>,
  terminalValueEUR: number,
  terminalDate: Date,
): number | null {
  if (cashflows.length === 0 && terminalValueEUR <= 0) return null

  const start = cashflows.length > 0 ? cashflows[0].date : terminalDate
  const flows = cashflows.map((cf) => ({
    tYears: daysBetween(start, cf.date) / 365.25,
    amount: cf.amount,
  }))
  if (terminalValueEUR > 0) {
    flows.push({
      tYears: daysBetween(start, terminalDate) / 365.25,
      amount: terminalValueEUR,
    })
  }

  const hasNeg = flows.some((f) => f.amount < 0)
  const hasPos = flows.some((f) => f.amount > 0)
  if (!hasNeg || !hasPos) return null

  let rate = 0.1
  for (let i = 0; i < 80; i++) {
    const f = npv(flows, rate)
    const h = 1e-6
    const f1 = npv(flows, rate + h)
    const derivative = safeDiv(f1 - f, h, 0)
    if (Math.abs(derivative) < 1e-12) break
    const next = rate - f / derivative
    if (!Number.isFinite(next)) break
    if (Math.abs(next - rate) < 1e-9) {
      rate = next
      break
    }
    rate = clamp(next, -0.9999, 10)
  }

  const finalNpv = npv(flows, rate)
  if (Math.abs(finalNpv) > 1e-2) return null
  return round4(rate * 100)
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

  const sumW = entries.reduce((s, e) => s + e.weight, 0)
  return entries.map((e) => ({
    key: e.key,
    label: e.label,
    weightPercent: round2(safeDiv(e.weight * 100, sumW, 0)),
    valueEUR: round2(safeDiv(e.weight * totalEUR, sumW, 0)),
  }))
}

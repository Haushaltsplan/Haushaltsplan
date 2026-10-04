export type BenchmarkId = 'SPY' | 'URTH'

export type BenchmarkVergleichErgebnis = {
  von: string
  bis: string
  benchmarks: Array<{
    id: BenchmarkId
    label: string
    totalReturnPct: number | null
    serieBase100: Array<{ date: string; value: number }>
  }>
}

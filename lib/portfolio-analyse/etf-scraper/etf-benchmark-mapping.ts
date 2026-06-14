export type EtfBenchmark =
  | 'SP500_CAP'
  | 'SP500_EQUAL'
  | 'NASDAQ100'

const ISIN_BENCHMARK: Record<string, EtfBenchmark> = {
  LU1681048804: 'SP500_CAP',
  IE00BLNMYC90: 'SP500_EQUAL',
  LU1681038243: 'NASDAQ100',
}

export function etfBenchmarkFuerIsin(isin: string): EtfBenchmark | null {
  return ISIN_BENCHMARK[isin.trim().toUpperCase()] ?? null
}

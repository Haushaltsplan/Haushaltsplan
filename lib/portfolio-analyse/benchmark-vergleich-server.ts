import 'server-only'

import type { BenchmarkId, BenchmarkVergleichErgebnis } from '@/lib/portfolio-analyse/benchmark-vergleich-types'
import { ladeYahooHistorieTaeglich } from '@/lib/portfolio-analyse/yahoo-historie-server'

export type { BenchmarkId, BenchmarkVergleichErgebnis } from '@/lib/portfolio-analyse/benchmark-vergleich-types'

function mapZuSerie(m: Map<string, number>): Array<{ date: string; close: number }> {
  return [...m.entries()]
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close }))
}

function base100(serie: Array<{ date: string; close: number }>): Array<{ date: string; value: number }> {
  if (serie.length === 0) return []
  const first = serie[0]!.close
  if (!(first > 0)) return []
  return serie.map((p) => ({ date: p.date, value: (p.close / first) * 100 }))
}

export async function ladeBenchmarkVergleich(opts: {
  von: string
  bis: string
}): Promise<BenchmarkVergleichErgebnis> {
  const von = opts.von.slice(0, 10)
  const bis = opts.bis.slice(0, 10)

  const [spy, urth] = await Promise.all([
    ladeYahooHistorieTaeglich('SPY', von, bis),
    ladeYahooHistorieTaeglich('URTH', von, bis),
  ])

  function pack(id: BenchmarkId, label: string, raw: Map<string, number>) {
    const serie = base100(mapZuSerie(raw))
    const totalReturnPct =
      serie.length >= 2 ? Math.round((serie[serie.length - 1]!.value - 100) * 100) / 100 : null
    return { id, label, totalReturnPct, serieBase100: serie }
  }

  return {
    von,
    bis,
    benchmarks: [
      pack('SPY', 'S&P 500 (SPY)', spy),
      pack('URTH', 'MSCI World (URTH)', urth),
    ],
  }
}

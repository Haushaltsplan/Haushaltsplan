'use client'

import { PaFundamentalKursChart } from '@/components/portfolio-analyse/pa-fundamental-kurs-chart'
import { PaFundamentalKeyMetrics } from '@/components/portfolio-analyse/pa-fundamental-key-metrics'
import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export function PaFundamentalUebersicht({
  symbolYahoo,
  ticker,
  firmenname,
  metriken,
  onMetricClick,
}: {
  symbolYahoo: string | null
  ticker: string
  firmenname: string
  metriken: FundamentalKeyMetric[]
  onMetricClick?: (metricId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80 ring-1 ring-white/[0.03]">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border-b border-zinc-800/60 lg:border-b-0 lg:border-r">
          <PaFundamentalKursChart
            symbolYahoo={symbolYahoo}
            ticker={ticker}
            firmenname={firmenname}
            kompakt
          />
        </div>
        <PaFundamentalKeyMetrics metriken={metriken} onMetricClick={onMetricClick} />
      </div>
    </div>
  )
}

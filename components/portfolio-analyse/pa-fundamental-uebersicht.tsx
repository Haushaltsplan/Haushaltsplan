'use client'

import { PaFundamentalKursChart } from '@/components/portfolio-analyse/pa-fundamental-kurs-chart'
import { PaFundamentalKeyMetrics } from '@/components/portfolio-analyse/pa-fundamental-key-metrics'
import type {
  FundamentalGuvQuelle,
  FundamentalKeyMetric,
  FundamentalSchaetzungQuelle,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export function PaFundamentalUebersicht({
  symbolYahoo,
  ticker,
  firmenname,
  metriken,
  onMetricClick,
  verfuegbareZeilenIds,
  guvQuelle,
  schaetzungQuelle,
  fallbackPaketQuelle,
}: {
  symbolYahoo: string | null
  ticker: string
  firmenname: string
  metriken: FundamentalKeyMetric[]
  onMetricClick?: (metricId: string) => void
  verfuegbareZeilenIds?: Set<string>
  guvQuelle?: FundamentalGuvQuelle | null
  schaetzungQuelle?: FundamentalSchaetzungQuelle | null
  fallbackPaketQuelle?: 'macrotrends' | 'yahoo' | 'marketscreener' | null
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border-b border-[var(--app-border)] lg:border-b-0 lg:border-r">
          <PaFundamentalKursChart
            symbolYahoo={symbolYahoo}
            ticker={ticker}
            firmenname={firmenname}
            kompakt
          />
        </div>
        <div className="min-h-[320px]">
          <PaFundamentalKeyMetrics
            metriken={metriken}
            onMetricClick={onMetricClick}
            verfuegbareZeilenIds={verfuegbareZeilenIds}
            guvQuelle={guvQuelle}
            schaetzungQuelle={schaetzungQuelle}
            fallbackPaketQuelle={fallbackPaketQuelle}
          />
        </div>
      </div>
    </div>
  )
}

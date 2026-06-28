'use client'

import { WhoopTrendChart } from '@/components/fitnessdaten/whoop-trend-chart'
import {
  appModalScrollHiddenClassName,
  whoopModalBackdropClassName,
  whoopModalPanelClassName,
} from '@/lib/app-modal-overlay'
import { getMetricInfo } from '@/lib/fitnessdaten/metric-explanations'
import {
  HOME_METRICS,
  baselineFuerMetrik,
  formatMetricWert,
  heuteWert,
  trendInsight,
  trendPunkte,
  type HomeMetricId,
  type TrendZeitraum,
} from '@/lib/fitnessdaten/trend-data'
import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import { useEffect, useMemo, useState } from 'react'

const ZEITRAEUME: { id: TrendZeitraum; label: string }[] = [
  { id: 'woche', label: 'W' },
  { id: 'monat', label: 'M' },
  { id: '6monate', label: '6M' },
]

type Props = {
  metricId: HomeMetricId | null
  heute: WhoopDayRecord
  onClose: () => void
}

export function WhoopMetricTrendModal({ metricId, heute, onClose }: Props) {
  const [zeitraum, setZeitraum] = useState<TrendZeitraum>('monat')
  const meta = HOME_METRICS.find((m) => m.id === metricId)
  const info = metricId ? getMetricInfo(meta?.infoId ?? 'hrv') : null

  const points = useMemo(
    () => (metricId ? trendPunkte(metricId, zeitraum) : []),
    [metricId, zeitraum],
  )

  const chartPoints = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        label: p.label || new Date(p.date + 'T12:00:00').toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'short',
        }),
        value: p.value,
      })),
    [points],
  )

  const heuteVal = metricId ? heuteWert(metricId, heute) : null
  const monatsAvg = metricId ? baselineFuerMetrik(metricId) : null
  const useLine =
    metricId === 'hrv' ||
    metricId === 'rhr' ||
    metricId === 'respiratory' ||
    metricId === 'vo2max' ||
    metricId === 'avg_hr'

  useEffect(() => {
    if (!metricId) return
    const unlock = lockAppScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [metricId, onClose])

  if (!metricId || !meta || !info) return null

  const formatVal = (v: number) => formatMetricWert(metricId, v, meta.decimals ?? 0)
  const insight = trendInsight(metricId, heuteVal, monatsAvg)

  return (
    <div className={whoopModalBackdropClassName} role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[8px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className={`${whoopModalPanelClassName} max-h-[92dvh] bg-[#0a0b0c]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Trendanzeige</p>
            <h2 className="mt-1 text-base font-semibold uppercase tracking-wide text-white">{meta.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--app-text-muted)] hover:bg-white/[0.06] hover:text-white"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex shrink-0 justify-end gap-1 border-b border-white/[0.06] px-4 py-2">
          {ZEITRAEUME.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setZeitraum(z.id)}
              className={`min-w-[2.5rem] rounded-lg py-2 text-[11px] font-bold transition ${
                zeitraum === z.id
                  ? 'bg-white/[0.12] text-white'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>

        <div className={`${appModalScrollHiddenClassName} px-4 py-4`}>
          <WhoopTrendChart
            title={meta.label}
            unit={meta.unit}
            points={chartPoints}
            monthlyAvg={monatsAvg}
            variant={useLine ? 'line' : 'bar'}
            formatValue={formatVal}
            insight={insight}
          />

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Was ist das?</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">{info.body}</p>
            {info.source ? (
              <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">Quelle: {info.source}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

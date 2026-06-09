'use client'

import {
  WhoopWeeklyBarChart,
  WhoopWeeklyLineChart,
} from '@/components/fitnessdaten/whoop-charts'
import {
  appModalScrollHiddenClassName,
  whoopModalBackdropClassName,
  whoopModalPanelClassName,
} from '@/lib/app-modal-overlay'
import { getMetricInfo } from '@/lib/fitnessdaten/metric-explanations'
import {
  HOME_METRICS,
  formatMetricWert,
  heuteWert,
  trendPunkte,
  type HomeMetricId,
  type TrendZeitraum,
} from '@/lib/fitnessdaten/trend-data'
import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { useEffect, useMemo, useState } from 'react'

const ZEITRAEUME: { id: TrendZeitraum; label: string }[] = [
  { id: 'woche', label: '7 Tage' },
  { id: 'monat', label: '30 Tage' },
  { id: '6monate', label: '6 Monate' },
]

type Props = {
  metricId: HomeMetricId | null
  heute: WhoopDayRecord
  onClose: () => void
}

export function WhoopMetricTrendModal({ metricId, heute, onClose }: Props) {
  const [zeitraum, setZeitraum] = useState<TrendZeitraum>('woche')
  const meta = HOME_METRICS.find((m) => m.id === metricId)
  const info = metricId ? getMetricInfo(meta?.infoId ?? 'hrv') : null

  const points = useMemo(
    () => (metricId ? trendPunkte(metricId, zeitraum) : []),
    [metricId, zeitraum],
  )

  const heuteVal = metricId ? heuteWert(metricId, heute) : null
  const useLine = metricId === 'hrv' || metricId === 'rhr' || metricId === 'respiratory' || metricId === 'vo2max'

  useEffect(() => {
    if (!metricId) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [metricId, onClose])

  if (!metricId || !meta || !info) return null

  const formatVal = (v: number) => formatMetricWert(metricId, v, meta.decimals ?? 0)

  return (
    <div className={whoopModalBackdropClassName} role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[8px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className={`${whoopModalPanelClassName} max-h-[90dvh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Verlauf</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{meta.label}</h2>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#5eb3d6]">
              {formatMetricWert(metricId, heuteVal, meta.decimals ?? 0)}
              {meta.unit ? (
                <span className="ml-2 text-sm font-medium text-zinc-500">{meta.unit}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-4 py-2">
          {ZEITRAEUME.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setZeitraum(z.id)}
              className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition ${
                zeitraum === z.id
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>

        <div className={`${appModalScrollHiddenClassName} px-4 py-4`}>
          {useLine ? (
            <WhoopWeeklyLineChart title={meta.label} points={points} />
          ) : (
            <WhoopWeeklyBarChart
              title={meta.label}
              points={points}
              formatValue={formatVal}
            />
          )}

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Was ist das?</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{info.body}</p>
            {info.source ? (
              <p className="mt-2 text-[11px] text-zinc-500">Quelle: {info.source}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

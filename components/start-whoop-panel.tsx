'use client'

import { WhoopMetricTrendModal } from '@/components/fitnessdaten/whoop-metric-trend-modal'
import { PageSectionPanel } from '@/components/page-shell'
import { baueWhoopDashboard } from '@/lib/fitnessdaten/metrics-engine'
import { ladeFitnessSnapshot } from '@/lib/fitnessdaten/history-storage'
import { WHOOP_BLE_SNAPSHOT_EVENT } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { WHOOP_CLOUD_SYNC_EVENT } from '@/lib/fitnessdaten/whoop-cloud-merge'
import {
  HOME_METRICS,
  baselineFuerMetrik,
  formatMetricWert,
  heuteWert,
  type HomeMetricId,
} from '@/lib/fitnessdaten/trend-data'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

export function StartWhoopPanel() {
  const [revision, setRevision] = useState(0)
  const [trendMetric, setTrendMetric] = useState<HomeMetricId | null>(null)

  useEffect(() => {
    const bump = () => setRevision((r) => r + 1)
    window.addEventListener(WHOOP_CLOUD_SYNC_EVENT, bump)
    window.addEventListener(WHOOP_BLE_SNAPSHOT_EVENT, bump)
    return () => {
      window.removeEventListener(WHOOP_CLOUD_SYNC_EVENT, bump)
      window.removeEventListener(WHOOP_BLE_SNAPSHOT_EVENT, bump)
    }
  }, [])

  const model = useMemo(() => baueWhoopDashboard(ladeFitnessSnapshot()), [revision])
  const { heute } = model
  const hasData =
    heute.recoveryPercent != null ||
    heute.strain != null ||
    heute.steps != null ||
    heute.calories != null ||
    heute.hrvRmssd != null

  return (
    <>
      <PageSectionPanel density="compact">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400/80">WHOOP</p>
            <h3 className="text-sm font-semibold text-zinc-200">Gesundheit heute</h3>
          </div>
          <Link
            href="/fitnessdaten"
            className="rounded-lg border border-orange-500/25 bg-orange-950/20 px-2.5 py-1 text-[11px] font-semibold text-orange-200 transition hover:bg-orange-950/40"
          >
            Öffnen →
          </Link>
        </div>

        {!hasData ? (
          <p className="text-xs leading-relaxed text-zinc-500">
            Noch keine WHOOP-Daten — verbinde dein Band oder synchronisiere die WHOOP-Cloud unter{' '}
            <Link href="/fitnessdaten" className="text-orange-300 underline-offset-2 hover:underline">
              Whoop
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {HOME_METRICS.map((m) => {
              const val = heuteWert(m.id, heute)
              const base = baselineFuerMetrik(m.id)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setTrendMetric(m.id)}
                    className="flex w-full flex-col rounded-xl border border-white/[0.06] bg-zinc-900/50 px-3 py-2.5 text-left transition hover:border-orange-500/30 hover:bg-zinc-900/80"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      {m.label}
                    </span>
                    <span className="mt-1 text-lg font-bold tabular-nums text-white">
                      {formatMetricWert(m.id, val, m.decimals ?? 0)}
                      {m.unit && val != null ? (
                        <span className="ml-1 text-[10px] font-medium text-zinc-500">{m.unit}</span>
                      ) : null}
                    </span>
                    {base != null ? (
                      <span className="mt-0.5 text-[10px] text-zinc-600">
                        Monats-Ø: {formatMetricWert(m.id, base, m.decimals ?? 0)}
                        {m.unit ? ` ${m.unit}` : ''}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PageSectionPanel>

      <WhoopMetricTrendModal
        metricId={trendMetric}
        heute={heute}
        onClose={() => setTrendMetric(null)}
      />
    </>
  )
}

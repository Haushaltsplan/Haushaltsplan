'use client'

import { WhoopMetricTrendModal } from '@/components/fitnessdaten/whoop-metric-trend-modal'
import { WhoopRing, recoveryColor } from '@/components/fitnessdaten/whoop-ring'
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

  const vitalsOk = [
    heute.hrvRmssd,
    heute.restingHr,
    heute.respiratoryRate,
    heute.avgHr,
    heute.spo2Percent,
  ].filter((v) => v != null && v > 0).length

  return (
    <>
      <PageSectionPanel density="compact">
        <div className="overflow-hidden rounded-2xl bg-[#0a0b0c] -m-1 p-1">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-lg font-black tracking-[0.28em] text-white">WHOOP</p>
          <Link
            href="/fitnessdaten"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text)] transition hover:bg-white/[0.08]"
          >
            Öffnen →
          </Link>
        </div>

        {!hasData ? (
          <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
            Noch keine WHOOP-Daten — verbinde dein Band oder synchronisiere die WHOOP-Cloud unter{' '}
            <Link href="/fitnessdaten" className="text-[#009dff] underline-offset-2 hover:underline">
              Whoop
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="flex items-end justify-center gap-3 sm:gap-6">
              <WhoopRing
                value={heute.sleepScore ?? 0}
                label="Schlaf"
                color="#7b61ff"
                size={88}
                stroke={6}
                unavailable={heute.sleepScore == null}
                onPress={() => {}}
              />
              <WhoopRing
                value={heute.recoveryPercent ?? 0}
                label="Erholung"
                color={recoveryColor(heute.recoveryPercent)}
                size={112}
                stroke={8}
                unavailable={heute.recoveryPercent == null}
                onPress={() => {}}
              />
              <WhoopRing
                value={heute.strain ?? 0}
                max={21}
                label="Belastung"
                color="#009dff"
                size={88}
                stroke={6}
                unavailable={heute.strain == null}
                onPress={() => {}}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href="/fitnessdaten?tab=health"
                className="rounded-xl border border-white/[0.06] bg-[#141618] px-3 py-2.5 transition hover:border-emerald-500/30"
              >
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">Gesundheitsmonitor</p>
                <p className="mt-1 text-xs font-semibold text-emerald-400">
                  {vitalsOk >= 4 ? 'Normalbereich' : 'Daten unvollständig'}
                </p>
                <p className="text-[10px] text-[var(--app-text-muted)]">{vitalsOk}/5 Messwerte</p>
              </Link>
              <button
                type="button"
                onClick={() => setTrendMetric('steps')}
                className="rounded-xl border border-white/[0.06] bg-[#141618] px-3 py-2.5 text-left transition hover:border-[#009dff]/30"
              >
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">Schritte heute</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">
                  {formatMetricWert('steps', heuteWert('steps', heute))}
                </p>
                {baselineFuerMetrik('steps') != null ? (
                  <p className="text-[10px] text-[var(--app-text-muted)]">
                    Monats-Ø: {formatMetricWert('steps', baselineFuerMetrik('steps'))}
                  </p>
                ) : null}
              </button>
            </div>

            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {HOME_METRICS.filter((m) => m.id !== 'steps').map((m) => {
                const val = heuteWert(m.id, heute)
                const base = baselineFuerMetrik(m.id)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setTrendMetric(m.id)}
                      className="flex w-full flex-col rounded-xl border border-white/[0.06] bg-[#141618] px-3 py-2.5 text-left transition hover:border-[#009dff]/30"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                        {m.label}
                      </span>
                      <span className="mt-1 text-base font-bold tabular-nums text-white">
                        {formatMetricWert(m.id, val, m.decimals ?? 0)}
                        {m.unit && val != null ? (
                          <span className="ml-1 text-[10px] font-medium text-[var(--app-text-muted)]">{m.unit}</span>
                        ) : null}
                      </span>
                      {base != null ? (
                        <span className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
                          Monats-Ø: {formatMetricWert(m.id, base, m.decimals ?? 0)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        </div>
      </PageSectionPanel>

      <WhoopMetricTrendModal
        metricId={trendMetric}
        heute={heute}
        onClose={() => setTrendMetric(null)}
      />
    </>
  )
}

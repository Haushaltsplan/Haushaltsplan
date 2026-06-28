'use client'

import { WhoopHrChart } from '@/components/fitnessdaten/whoop-hr-chart'
import {
  formatDauerMin,
  formatUhrzeit,
} from '@/lib/fitnessdaten/activity-detect'
import {
  appModalScrollHiddenClassName,
  whoopModalBackdropClassName,
  whoopModalPanelClassName,
} from '@/lib/app-modal-overlay'
import { getMetricInfo } from '@/lib/fitnessdaten/metric-explanations'
import { ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import type { WhoopActivity } from '@/lib/fitnessdaten/daily-records'
import { useEffect, useMemo } from 'react'

type Props = {
  activity: WhoopActivity | null
  onClose: () => void
}

export function WhoopActivityModal({ activity, onClose }: Props) {
  const info = getMetricInfo('activities')

  const hrPoints = useMemo(() => {
    if (!activity) return []
    const history = ladeFitnessHistory()
    return history.hrSeries
      .filter((p) => p.t >= activity.startMs - 60_000 && p.t <= activity.endMs + 60_000)
      .map((p) => ({ t: p.t, bpm: p.bpm }))
  }, [activity])

  useEffect(() => {
    if (!activity) return
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
  }, [activity, onClose])

  if (!activity) return null

  const datum = activity.date ?? new Date(activity.startMs).toISOString().slice(0, 10)
  const datumLabel = new Date(datum + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

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
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Aktivität</p>
            <h2 className="mt-1 text-lg font-semibold uppercase text-white">{activity.label}</h2>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">{datumLabel}</p>
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

        <div className={`${appModalScrollHiddenClassName} space-y-4 px-5 py-4`}>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-[#009dff]/20">
              <span className="text-2xl font-bold text-[#009dff]">{activity.strain.toFixed(1)}</span>
              <span className="text-[9px] font-bold uppercase text-[var(--app-text-muted)]">Strain</span>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
              <Stat label="Zeit" value={`${formatUhrzeit(activity.startMs)} – ${formatUhrzeit(activity.endMs)}`} />
              <Stat label="Dauer" value={formatDauerMin(activity.startMs, activity.endMs)} />
              <Stat label="Ø HF" value={activity.avgHr != null ? `${activity.avgHr} bpm` : '—'} />
              <Stat label="Max HF" value={activity.maxHr != null ? `${activity.maxHr} bpm` : '—'} />
              <Stat label="Kalorien" value={activity.calories != null ? `${activity.calories} kcal` : '—'} />
              <Stat label="Sport" value={activity.sport ?? activity.label} />
            </div>
          </div>

          {hrPoints.length >= 3 ? (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                Herzfrequenz-Verlauf
              </p>
              <WhoopHrChart points={hrPoints} live={false} />
            </div>
          ) : (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-xs text-[var(--app-text-muted)]">
              Kein detaillierter HF-Verlauf — verbinde das Band per BLE oder synchronisiere WHOOP Cloud für
              Workout-Daten.
            </p>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Analyse</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">{info.body}</p>
            {activity.strain >= 14 ? (
              <p className="mt-2 text-sm text-amber-200/90">
                Hohe Belastung — plane morgen ausreichend Erholung ein.
              </p>
            ) : activity.strain >= 8 ? (
              <p className="mt-2 text-sm text-emerald-200/80">
                Moderate bis intensive Belastung — gut für deine Fitnessentwicklung.
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">Leichte Aktivität — trägt zum Tages-Strain bei.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-0.5 font-semibold text-[var(--app-text)]">{value}</p>
    </div>
  )
}

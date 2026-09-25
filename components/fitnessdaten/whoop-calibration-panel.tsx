'use client'

import {
  autoFitCalibrationParams,
  calibrationStats,
  exportCalibrationJson,
  ladeCalibrationLog,
} from '@/lib/fitnessdaten/calibration/calibration-log'
import {
  ladeCalibrationParams,
  resetCalibrationParams,
  type CalibrationParams,
} from '@/lib/fitnessdaten/calibration/calibration-params'
import type { CalibrationMetric } from '@/lib/fitnessdaten/calibration/calibration-types'
import { useMemo, useState } from 'react'

const METRIC_LABEL: Record<CalibrationMetric, string> = {
  strain: 'Strain',
  recovery: 'Recovery %',
  rhr: 'RHR',
  hrv: 'HRV',
  respiratory: 'Atemfreq.',
  sleep_minutes: 'Schlaf min',
  sleep_score: 'Schlaf-Score',
  sleep_efficiency: 'Schlaf-Eff.',
  steps: 'Schritte',
  vo2max: 'VO₂ Max',
  calories: 'Kalorien',
}

type Props = {
  cloudConnected: boolean
}

export function WhoopCalibrationPanel({ cloudConnected }: Props) {
  const [tick, setTick] = useState(0)
  const stats = useMemo(() => calibrationStats(undefined, 30), [tick])
  const params = useMemo(() => ladeCalibrationParams(), [tick])
  const log = useMemo(() => ladeCalibrationLog(), [tick])
  const recent = useMemo(
    () =>
      [...log.pairs]
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
        .slice(0, 12),
    [log, tick],
  )

  const refresh = () => setTick((t) => t + 1)

  const onFit = () => {
    autoFitCalibrationParams(5)
    refresh()
  }

  const onReset = () => {
    resetCalibrationParams()
    refresh()
  }

  const onExport = () => {
    const blob = new Blob([exportCalibrationJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `whoop-calibration-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!cloudConnected && stats.every((s) => s.n === 0)) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
          Offline-Kalibrierung
        </p>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          Whoop verbinden und syncen — dann erscheinen Local-vs-Cloud-Paare hier.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-500/20 bg-[#111113] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-400/90">
              Offline-Kalibrierung
            </p>
            <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">
              Cloud = Soll (Abo). Lokal rechnet parallel. Ziel: Formeln so nah wie möglich an Whoop.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={onFit}
              className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300"
            >
              Auto-Fit
            </button>
            <button
              type="button"
              onClick={onExport}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-zinc-300"
            >
              Export
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-zinc-500"
            >
              Reset
            </button>
          </div>
        </div>
        {log.lastFitAt && (
          <p className="mt-2 text-[10px] text-zinc-500">
            Letzter Fit: {new Date(log.lastFitAt).toLocaleString('de-DE')}
          </p>
        )}
        {log.notes[0] && (
          <p className="mt-1 text-[10px] text-zinc-500 truncate">{log.notes[0]}</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden">
        <div className="grid grid-cols-[1.2fr_0.5fr_0.7fr_0.7fr_0.7fr] gap-1 border-b border-white/[0.06] px-3 py-2 text-[9px] font-bold uppercase text-zinc-500">
          <span>Metrik</span>
          <span>n</span>
          <span>MAE</span>
          <span>|Med|</span>
          <span>Bias</span>
        </div>
        {stats.length === 0 ? (
          <p className="px-3 py-3 text-sm text-zinc-500">Noch keine Paare — Sync tippen.</p>
        ) : (
          stats.map((s) => (
            <div
              key={s.metric}
              className="grid grid-cols-[1.2fr_0.5fr_0.7fr_0.7fr_0.7fr] gap-1 border-b border-white/[0.04] px-3 py-2 text-[12px] tabular-nums"
            >
              <span className="text-zinc-200">{METRIC_LABEL[s.metric]}</span>
              <span className="text-zinc-500">{s.n}</span>
              <span className={s.mae > 0 ? 'text-zinc-200' : 'text-zinc-600'}>{s.mae}</span>
              <span className="text-zinc-400">{s.medianAbs}</span>
              <span className={s.bias > 0 ? 'text-amber-400' : s.bias < 0 ? 'text-sky-400' : 'text-zinc-500'}>
                {s.bias > 0 ? `+${s.bias}` : s.bias}
              </span>
            </div>
          ))
        )}
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden">
          <p className="px-3 py-2 text-[9px] font-bold uppercase text-zinc-500">Letzte Paare</p>
          {recent.map((p, i) => (
            <div
              key={`${p.date}-${p.metric}-${i}`}
              className="flex items-center justify-between gap-2 border-t border-white/[0.04] px-3 py-2 text-[11px]"
            >
              <span className="text-zinc-500">
                {p.date.slice(5)} · {METRIC_LABEL[p.metric]}
              </span>
              <span className="tabular-nums text-zinc-300">
                L {p.local} / W {p.whoop}{' '}
                <span className={p.delta >= 0 ? 'text-amber-400' : 'text-sky-400'}>
                  ({p.delta >= 0 ? '+' : ''}
                  {p.delta})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <ParamSummary params={params} />
    </div>
  )
}

function ParamSummary({ params }: { params: CalibrationParams }) {
  const rows: [string, string | number][] = [
    ['strainScale', params.strainScale],
    ['strainLogBase', params.strainLogBase],
    ['recoveryHrvW', params.recoveryHrvWeight],
    ['recoveryScale', params.recoveryScale],
    ['sleepMinScale', params.sleepMinutesScale],
    ['stepsScale', params.stepsScale],
    ['vo2Scale', params.vo2Scale],
    ['kcalScale', params.caloriesScale],
  ]
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-3 py-2">
      <p className="text-[9px] font-bold uppercase text-zinc-500 mb-1">Aktive Parameter</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] tabular-nums text-zinc-400">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span>{k}</span>
            <span className="text-zinc-200">{typeof v === 'number' ? Number(v.toFixed(3)) : v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

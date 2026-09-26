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
import {
  istOmniaOfflineMode,
  setzeOmniaOfflineMode,
} from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
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
  sleep_need: 'Schlafbedarf',
  sleep_rem: 'REM min',
  sleep_deep: 'Tiefschlaf',
  sleep_consistency: 'Schlaf-Kons.',
  steps: 'Schritte',
  vo2max: 'VO₂ Max',
  calories: 'Kalorien',
  skin_temp: 'Hauttemp.',
  spo2: 'SpO₂',
  avg_hr: 'Ø HF',
}

const PHASE_TARGETS: Partial<
  Record<CalibrationMetric, { maxMedianAbs: number; minN: number; phase: string }>
> = {
  strain: { maxMedianAbs: 1, minN: 7, phase: 'A' },
  recovery: { maxMedianAbs: 8, minN: 7, phase: 'A' },
  rhr: { maxMedianAbs: 3, minN: 7, phase: 'B' },
  hrv: { maxMedianAbs: 8, minN: 7, phase: 'B' },
  respiratory: { maxMedianAbs: 1.5, minN: 7, phase: 'B' },
  skin_temp: { maxMedianAbs: 0.4, minN: 5, phase: 'B' },
  sleep_minutes: { maxMedianAbs: 45, minN: 7, phase: 'C' },
  sleep_score: { maxMedianAbs: 12, minN: 7, phase: 'C' },
  sleep_efficiency: { maxMedianAbs: 10, minN: 7, phase: 'C' },
  sleep_need: { maxMedianAbs: 40, minN: 7, phase: 'C' },
  sleep_rem: { maxMedianAbs: 25, minN: 7, phase: 'C' },
  sleep_deep: { maxMedianAbs: 25, minN: 7, phase: 'C' },
  sleep_consistency: { maxMedianAbs: 12, minN: 5, phase: 'C' },
  steps: { maxMedianAbs: 1500, minN: 7, phase: 'D' },
  calories: { maxMedianAbs: 250, minN: 7, phase: 'D' },
  vo2max: { maxMedianAbs: 2, minN: 5, phase: 'D' },
  avg_hr: { maxMedianAbs: 5, minN: 7, phase: 'D' },
}

type Props = {
  cloudConnected: boolean
}

export function WhoopCalibrationPanel({ cloudConnected }: Props) {
  const [tick, setTick] = useState(0)
  const [offline, setOffline] = useState(() => istOmniaOfflineMode())
  const stats = useMemo(() => calibrationStats(undefined, 30, { onlyShadow: true }), [tick])
  const params = useMemo(() => ladeCalibrationParams(), [tick])
  const log = useMemo(() => ladeCalibrationLog(), [tick])
  const recent = useMemo(
    () =>
      [...log.pairs]
        .filter((p) => p.source === 'shadow' || p.source == null)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
        .slice(0, 12),
    [log, tick],
  )

  const refresh = () => setTick((t) => t + 1)

  const strainGate = stats.find((s) => s.metric === 'strain')
  const recoveryGate = stats.find((s) => s.metric === 'recovery')
  const strainOk =
    strainGate != null &&
    strainGate.n >= 7 &&
    strainGate.medianAbs <= 1
  const recoveryOk =
    recoveryGate != null &&
    recoveryGate.n >= 7 &&
    recoveryGate.medianAbs <= 8

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

  const onToggleOffline = () => {
    const next = !offline
    setzeOmniaOfflineMode(next)
    setOffline(next)
    refresh()
  }

  if (!cloudConnected && stats.every((s) => s.n === 0) && !offline) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
          Offline-Kalibrierung
        </p>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          Whoop verbinden, BLE tragen und syncen — dann erscheinen echte Shadow-Paare hier.
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
        Omnia = nur lokal (Lücken als —). Whoop = Cloud. SpO₂ in Omnia nur manuell.
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

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              strainOk ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-400'
            }`}
          >
            Strain {strainOk ? 'OK' : '…'}{' '}
            {strainGate ? `|Med| ${strainGate.medianAbs} (n=${strainGate.n})` : '(keine Paare)'}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              recoveryOk ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-400'
            }`}
          >
            Recovery {recoveryOk ? 'OK' : '…'}{' '}
            {recoveryGate
              ? `|Med| ${recoveryGate.medianAbs} (n=${recoveryGate.n})`
              : '(keine Paare)'}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleOffline}
          className={`mt-3 w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition ${
            offline
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/5 text-zinc-300 border border-white/10'
          }`}
        >
          {offline ? 'Omnia Offline-Modus AN — Lokal primär' : 'Omnia Offline-Modus AUS — Whoop Cloud UI'}
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
            Abo-Ende: einschalten. Cloud-Overrides werden für die Anzeige ignoriert.
          </span>
        </button>

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
        <div className="grid grid-cols-[1.2fr_0.4fr_0.6fr_0.6fr_0.6fr_0.5fr] gap-1 border-b border-white/[0.06] px-3 py-2 text-[9px] font-bold uppercase text-zinc-500">
          <span>Metrik</span>
          <span>n</span>
          <span>MAE</span>
          <span>|Med|</span>
          <span>Bias</span>
          <span>Ziel</span>
        </div>
        {stats.length === 0 ? (
          <p className="px-3 py-3 text-sm text-zinc-500">
            Noch keine Shadow-Paare — BLE tragen + Cloud syncen.
          </p>
        ) : (
          stats.map((s) => {
            const target = PHASE_TARGETS[s.metric]
            const ok =
              target != null && s.n >= target.minN && s.medianAbs <= target.maxMedianAbs
            return (
              <div
                key={s.metric}
                className="grid grid-cols-[1.2fr_0.4fr_0.6fr_0.6fr_0.6fr_0.5fr] gap-1 border-b border-white/[0.04] px-3 py-2 text-[12px] tabular-nums"
              >
                <span className="text-zinc-200">
                  {METRIC_LABEL[s.metric]}
                  {target ? (
                    <span className="ml-1 text-[9px] text-zinc-600">{target.phase}</span>
                  ) : null}
                </span>
                <span className="text-zinc-500">{s.n}</span>
                <span className={s.mae > 0 ? 'text-zinc-200' : 'text-zinc-600'}>{s.mae}</span>
                <span className="text-zinc-400">{s.medianAbs}</span>
                <span
                  className={
                    s.bias > 0 ? 'text-amber-400' : s.bias < 0 ? 'text-sky-400' : 'text-zinc-500'
                  }
                >
                  {s.bias > 0 ? `+${s.bias}` : s.bias}
                </span>
                <span className={ok ? 'text-emerald-400' : target ? 'text-zinc-600' : 'text-zinc-700'}>
                  {target ? (ok ? 'OK' : `≤${target.maxMedianAbs}`) : '—'}
                </span>
              </div>
            )
          })
        )}
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden">
          <p className="px-3 py-2 text-[9px] font-bold uppercase text-zinc-500">Letzte Shadow-Paare</p>
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
    ['recoverySleepW', params.recoverySleepWeight],
    ['recoveryScale', params.recoveryScale],
    ['sleepNeedBase', params.sleepNeedBaseMin],
    ['sleepRemRatio', params.sleepRemRatio],
    ['sleepDeepRatio', params.sleepDeepRatio],
    ['sleepMinScale', params.sleepMinutesScale],
    ['stepsScale', params.stepsScale],
    ['vo2Scale', params.vo2Scale],
    ['kcalScale', params.caloriesScale],
    ['respBase', params.respiratoryBaseline],
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

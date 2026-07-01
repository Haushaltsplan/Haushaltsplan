'use client'

import {
  WhoopDualLineChart,
  WhoopWeeklyBarChart,
  WhoopWeeklyLineChart,
} from '@/components/fitnessdaten/whoop-charts'
import { WhoopInsightCard } from '@/components/fitnessdaten/whoop-metric-row'
import {
  appModalScrollHiddenClassName,
  whoopModalBackdropClassName,
  whoopModalPanelClassName,
} from '@/lib/app-modal-overlay'
import {
  isoAddDays,
  kannTagVor,
  kannTagZurueck,
  labelTagNavigation,
} from '@/lib/fitnessdaten/daily-records'
import { getMetricInfo, type MetricInfoId } from '@/lib/fitnessdaten/metric-explanations'
import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import {
  berechneStressDetail,
  formatStressDe,
  stressChartPunkte,
  stressColor,
  stressFenster,
  stressInsight,
  stressLabel,
} from '@/lib/fitnessdaten/stress-engine'
import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import { useEffect, useMemo, useState } from 'react'

type Zeitraum = 'woche' | 'monat'

type Props = {
  open: boolean
  selectedDate: string
  heute: WhoopDayRecord
  hrvBaseline: number | null
  onClose: () => void
  onDateChange: (iso: string) => void
  onInfo?: (id: MetricInfoId) => void
}

const ZEITRAEUME: { id: Zeitraum; label: string; tage: number }[] = [
  { id: 'woche', label: 'W', tage: 7 },
  { id: 'monat', label: 'M', tage: 30 },
]

export function WhoopStressMonitorModal({
  open,
  selectedDate,
  heute,
  hrvBaseline,
  onClose,
  onDateChange,
  onInfo,
}: Props) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('woche')
  const info = getMetricInfo('stress')

  const tage = ZEITRAEUME.find((z) => z.id === zeitraum)?.tage ?? 7
  const fenster = useMemo(() => stressFenster(selectedDate, tage), [selectedDate, tage])

  const stressPunkte = useMemo(
    () => stressChartPunkte(fenster, selectedDate, hrvBaseline),
    [fenster, selectedDate, hrvBaseline],
  )

  const hrvPunkte = useMemo(
    () =>
      fenster.map((d) => ({
        label: new Date(d.date + 'T12:00:00').toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
        }),
        value: d.hrvRmssd ?? 0,
        highlight: d.date === selectedDate,
      })),
    [fenster, selectedDate],
  )

  const recoveryPunkte = useMemo(
    () =>
      fenster.map((d) => ({
        label: new Date(d.date + 'T12:00:00').toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
        }),
        value: d.recoveryPercent ?? 0,
        highlight: d.date === selectedDate,
      })),
    [fenster, selectedDate],
  )

  const rhrPunkte = useMemo(
    () =>
      fenster.map((d) => ({
        label: new Date(d.date + 'T12:00:00').toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
        }),
        value: d.restingHr ?? 0,
        highlight: d.date === selectedDate,
      })),
    [fenster, selectedDate],
  )

  const detail = berechneStressDetail(heute.recoveryPercent, heute.hrvRmssd, hrvBaseline)
  const insight = stressInsight(detail, hrvBaseline, heute.hrvRmssd)

  useEffect(() => {
    if (!open) return
    const unlock = lockAppScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const tagZurueck = () => {
    if (kannTagZurueck(selectedDate)) onDateChange(isoAddDays(selectedDate, -1))
  }

  const tagVor = () => {
    if (kannTagVor(selectedDate)) onDateChange(isoAddDays(selectedDate, 1))
  }

  return (
    <div className={whoopModalBackdropClassName} role="dialog" aria-modal aria-label="Stress-Monitor">
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
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
              Stress-Monitor
            </p>
            <h2 className="mt-1 text-base font-semibold uppercase tracking-wide text-white">
              {labelTagNavigation(selectedDate)}
            </h2>
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

        <div className="flex shrink-0 items-center justify-center gap-0.5 border-b border-white/[0.06] py-2">
          <button
            type="button"
            onClick={tagZurueck}
            disabled={!kannTagZurueck(selectedDate)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[15px] text-[var(--app-text-muted)] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
            aria-label="Vorheriger Tag"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onDateChange(heuteIsoLocal())}
            className="min-w-[5.5rem] rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
          >
            {labelTagNavigation(selectedDate)}
          </button>
          <button
            type="button"
            onClick={tagVor}
            disabled={!kannTagVor(selectedDate)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[15px] text-[var(--app-text-muted)] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
            aria-label="Nächster Tag"
          >
            ›
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

        <div className={`${appModalScrollHiddenClassName} space-y-4 px-4 py-4`}>
          <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
              Stress-Level
            </p>
            <p
              className="mt-2 text-5xl font-bold tabular-nums leading-none"
              style={{ color: stressColor(detail.score) }}
            >
              {detail.score != null ? formatStressDe(detail.score) : '—'}
            </p>
            <p
              className="mt-2 text-[12px] font-bold uppercase tracking-wider"
              style={{ color: stressColor(detail.score) }}
            >
              {stressLabel(detail.score)}
            </p>
            {detail.quelle ? (
              <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
                Basis: {detail.quelle === 'recovery' ? 'Erholung' : 'HFV'}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Erholung</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#00E676]">
                {heute.recoveryPercent != null ? `${Math.round(heute.recoveryPercent)} %` : '—'}
              </p>
              {detail.recoveryStress != null ? (
                <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
                  Stress: {formatStressDe(detail.recoveryStress)}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">HFV</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#a78bfa]">
                {heute.hrvRmssd != null ? `${Math.round(heute.hrvRmssd)} ms` : '—'}
              </p>
              {hrvBaseline != null ? (
                <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">Ø 30 T: {Math.round(hrvBaseline)} ms</p>
              ) : null}
            </div>
          </div>

          {insight ? <WhoopInsightCard text={insight} /> : null}

          <WhoopWeeklyBarChart
            title="Stress-Verlauf"
            points={stressPunkte}
            max={3}
            color="#00E5FF"
            formatValue={(v) => formatStressDe(v)}
            onInfo={() => onInfo?.('stress')}
          />

          <WhoopDualLineChart
            title="Stress vs. Erholung"
            labelA="Stress"
            labelB="Erholung %"
            seriesA={stressPunkte}
            seriesB={recoveryPunkte}
            colorA="#00E5FF"
            colorB="#00E676"
            formatValue={(v) => String(Math.round(v))}
            onInfo={() => onInfo?.('recovery')}
          />

          <WhoopWeeklyLineChart
            title="HFV (RMSSD)"
            points={hrvPunkte}
            color="#a78bfa"
            onInfo={() => onInfo?.('hrv')}
          />

          <WhoopWeeklyLineChart
            title="Ruheherzfrequenz"
            points={rhrPunkte}
            color="#f97316"
            onInfo={() => onInfo?.('rhr')}
          />

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
              {info.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">{info.body}</p>
            <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">Skala: 0,1 (niedrig) – 3,0 (hoch)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

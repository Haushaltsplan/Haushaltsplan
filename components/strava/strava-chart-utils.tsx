'use client'

import type { ReactNode } from 'react'

export function formatWatts(w: number | null | undefined): string {
  if (w == null || !Number.isFinite(w)) return '—'
  return `${Math.round(w)} W`
}

export function formatWkg(w: number | null | undefined): string {
  if (w == null || !Number.isFinite(w)) return '—'
  return `${w.toFixed(2)} W/kg`
}

export function formatKm(km: number): string {
  return `${km.toLocaleString('de-DE', { maximumFractionDigits: km >= 100 ? 0 : 1 })} km`
}

export function formatHm(hm: number): string {
  return `${Math.round(hm).toLocaleString('de-DE')} hm`
}

type HoverInfoProps = {
  hint?: string
  children?: ReactNode
}

/** Info-Zeile über Charts — zeigt Hover-Details oder Platzhalter-Hinweis. */
export function StravaChartHoverInfo({ hint = 'Mit der Maus über Chart-Elemente fahren für Details', children }: HoverInfoProps) {
  if (children) {
    return (
      <div className="mb-3 rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2.5 text-xs transition-opacity duration-150">
        {children}
      </div>
    )
  }
  return <p className="mb-3 text-[11px] text-[var(--app-text-muted)]">{hint}</p>
}

type GridProps = {
  padX: number
  padTop: number
  padBottom: number
  width: number
  height: number
  fractions?: number[]
}

export function StravaChartGrid({
  padX,
  padTop,
  padBottom,
  width,
  height,
  fractions = [0.25, 0.5, 0.75, 1],
}: GridProps) {
  const chartH = height - padTop - padBottom
  return (
    <>
      {fractions.map((f) => (
        <line
          key={f}
          x1={padX}
          y1={padTop + (1 - f) * chartH}
          x2={width - padX}
          y2={padTop + (1 - f) * chartH}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
    </>
  )
}

/** Log-Position für Power-Curve-Dauer (Sekunden → x). */
export function powerCurveX(seconds: number, minSec: number, maxSec: number, padX: number, chartW: number): number {
  const logMin = Math.log10(Math.max(minSec, 1))
  const logMax = Math.log10(Math.max(maxSec, minSec + 1))
  const logSec = Math.log10(Math.max(seconds, 1))
  const t = logMax > logMin ? (logSec - logMin) / (logMax - logMin) : 0
  return padX + t * chartW
}

export function yFromValue(value: number, min: number, max: number, padTop: number, chartH: number): number {
  const range = max - min || 1
  return padTop + (1 - (value - min) / range) * chartH
}

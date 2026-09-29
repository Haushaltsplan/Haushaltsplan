'use client'

import { WhoopChartHeader } from '@/components/fitnessdaten/whoop-info-modal'
import { WHOOP_COLORS } from '@/components/fitnessdaten/whoop-design-tokens'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

export const WHOOP_AXIS = {
  stroke: WHOOP_COLORS.axis,
  fontSize: 10,
  tickLine: false,
  axisLine: false,
  tick: { fill: WHOOP_COLORS.axis, fontSize: 10 },
} as const

export const WHOOP_GRID = {
  stroke: WHOOP_COLORS.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const

export const WHOOP_CHART_MARGIN = { top: 18, right: 8, bottom: 0, left: 8 } as const

export const WHOOP_ANIMATION = { isAnimationActive: true, animationDuration: 900, animationEasing: 'ease-out' } as const

export const WHOOP_CURSOR_LINE = { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1, strokeDasharray: '3 3' }
export const WHOOP_CURSOR_BAR = { fill: 'rgba(255,255,255,0.04)', radius: 8 }

export function WhoopCard({
  title,
  onInfo,
  legend,
  aside,
  children,
  className = '',
}: {
  title?: string
  onInfo?: () => void
  legend?: { label: string; color: string; dashed?: boolean }[]
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#12161F] p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      {title ? <WhoopChartHeader title={title} onInfo={onInfo} /> : null}
      {legend?.length || aside ? (
        <div className="-mt-1 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#8B93A1]">
          {legend?.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-3 rounded-full"
                style={
                  l.dashed
                    ? { backgroundImage: `repeating-linear-gradient(90deg, ${l.color} 0 3px, transparent 3px 5px)` }
                    : { background: l.color }
                }
              />
              {l.label}
            </span>
          ))}
          {aside ? <span className="ml-auto">{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function WhoopChartShell({ height = 170, children }: { height?: number; children: ReactElement }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden" data-no-swipe-nav>
      <ResponsiveContainer width="100%" height={height} debounce={50}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Vertikaler Verlauf: Farbe oben → transparent unten. */
export function WhoopAreaGradient({ id, color, top = 0.38 }: { id: string; color: string; top?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={top} />
      <stop offset="70%" stopColor={color} stopOpacity={top * 0.25} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

/** Balken-Verlauf: volle Farbe oben, leicht abgedunkelt unten. */
export function WhoopBarGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
    </linearGradient>
  )
}

export type WhoopTooltipRow = { label: string; value: string; color?: string }

export function WhoopTooltipBox({ title, rows }: { title?: ReactNode; rows: WhoopTooltipRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="pointer-events-none min-w-[8.5rem] rounded-xl border border-white/[0.10] bg-[#0B0E14]/80 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur-md">
      {title ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8B93A1]">{title}</p> : null}
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#8B93A1]">
              {r.color ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} /> : null}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Minimal-Typ der Recharts-Tooltip-Props (stabil über v2/v3). */
export type WhoopTooltipProps = {
  active?: boolean
  label?: unknown
  payload?: readonly {
    value?: unknown
    name?: unknown
    dataKey?: unknown
    color?: string
    payload?: Record<string, unknown>
  }[]
}

export function asTooltipProps(p: unknown): WhoopTooltipProps {
  return (p ?? {}) as WhoopTooltipProps
}

/** Nach dem ersten Paint `true` — für CSS-Transitions (Ringe, Leisten) ab 0. */
export function useWhoopReveal(): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return shown
}

export function formatHhMm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export function formatUhr(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

'use client'

import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import type { ReactElement, ReactNode } from 'react'
import {
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

export const STRAVA_CHART_AXIS = {
  stroke: '#52525b',
  fontSize: 10,
  tickLine: false,
  axisLine: { stroke: 'rgba(255,255,255,0.08)' },
}

export const STRAVA_CHART_GRID = {
  stroke: 'rgba(255,255,255,0.06)',
  strokeDasharray: '3 3',
}

type StravaChartShellProps = {
  height?: number
  minWidth?: number
  children: ReactElement
  brush?: boolean
  brushHeight?: number
}

export function StravaChartShell({
  height = 220,
  minWidth,
  children,
  brush = true,
  brushHeight = 22,
}: StravaChartShellProps) {
  const totalH = brush ? height + brushHeight + 8 : height
  return (
    <div className="w-full overflow-x-auto" style={minWidth ? { minWidth } : undefined}>
      <ResponsiveContainer width="100%" height={totalH} minWidth={minWidth ?? 280}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function StravaBrush(props: { dataKey?: string; height?: number }) {
  return (
    <Brush
      dataKey={props.dataKey ?? 'label'}
      height={props.height ?? 22}
      stroke={STRAVA_COLORS.orange}
      fill="rgba(252,76,2,0.08)"
      travellerWidth={8}
    />
  )
}

type StravaTooltipProps = {
  formatter?: (value: unknown, name: string) => ReactNode
  labelFormatter?: (label: unknown, payload: readonly unknown[]) => ReactNode
}

export function StravaTooltip({ formatter, labelFormatter }: StravaTooltipProps) {
  return (
    <Tooltip
      contentStyle={{
        background: 'rgba(12,13,15,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        fontSize: 11,
        padding: '8px 12px',
      }}
      labelStyle={{ color: '#f4f4f5', fontWeight: 600, marginBottom: 4 }}
      itemStyle={{ color: '#a1a1aa' }}
      formatter={(value, name) => {
        if (value == null) return ['—', name]
        if (formatter) return [formatter(value, String(name)), name]
        const n = typeof value === 'number' ? value : Number(value)
        return [Number.isFinite(n) ? (Number.isInteger(n) ? n : n.toFixed(1)) : '—', name]
      }}
      labelFormatter={labelFormatter}
      cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
    />
  )
}

export function StravaCartesianGrid() {
  return <CartesianGrid {...STRAVA_CHART_GRID} vertical={false} />
}

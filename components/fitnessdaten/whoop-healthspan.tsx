'use client'

import type { HealthspanMetric, HealthspanModel } from '@/lib/fitnessdaten/healthspan-engine'
import type { FitnessHrPoint } from '@/lib/fitnessdaten/types'

export function WhoopAgeOrb({
  whoopAge,
  yearsYounger,
  agingProcess,
  onInfo,
}: {
  whoopAge: number | null
  yearsYounger: number | null
  agingProcess: number | null
  onInfo?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className="relative w-full overflow-hidden rounded-3xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/60 to-[#050505] px-4 py-8 text-center"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-44 w-44 rounded-[40%] bg-emerald-500/20 blur-2xl" />
      </div>
      <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-[42%] bg-gradient-to-br from-emerald-400/30 via-emerald-600/20 to-teal-900/40 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums text-white">
            {whoopAge != null ? whoopAge.toFixed(1).replace('.', ',') : '—'}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">Omnia Age</p>
        </div>
      </div>
      <div className="relative mt-4 flex justify-between px-2 text-xs">
        <span className="text-emerald-400">
          {yearsYounger != null && yearsYounger > 0
            ? `${yearsYounger.toFixed(1).replace('.', ',')} Jahre jünger`
            : '—'}
        </span>
        <span className="text-[var(--app-text-muted)]">
          {agingProcess != null ? `${agingProcess.toFixed(1).replace('.', ',')}× Alterungsprozess` : '—'}
        </span>
      </div>
      <p className="relative mt-2 text-[10px] text-[var(--app-text-muted)]">Lokal geschätzt · Tippe für Erklärung</p>
    </button>
  )
}

export function WhoopAgingScale({
  value,
  trend,
  onInfo,
}: {
  value: number | null
  trend: HealthspanModel['agingTrend']
  onInfo?: () => void
}) {
  const pos = value != null ? Math.min(1, Math.max(0, (value + 1) / 4)) : 0.5
  const badge =
    trend === 'slower'
      ? '▲ langsamer im Vgl. zur Baseline'
      : trend === 'faster'
        ? '▲ schneller im Vgl. zur Baseline'
        : '● stabil'

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <button type="button" onClick={onInfo} className="flex w-full items-center justify-between text-left">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Alterungsprozess</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
            trend === 'faster' ? 'bg-orange-950/50 text-orange-200' : 'bg-emerald-950/40 text-emerald-300'
          }`}
        >
          {badge}
        </span>
      </button>
      <p className="mt-3 text-center text-4xl font-bold tabular-nums text-white">
        {value != null ? `${value.toFixed(1).replace('.', ',')}×` : '—'}
      </p>
      <div className="relative mt-4 h-8">
        <div className="absolute inset-x-0 top-3 flex justify-between text-[8px] text-[var(--app-text-muted)]">
          <span>Langsam</span>
          <span>Schnell</span>
        </div>
        <div className="absolute inset-x-0 top-1 flex h-4 items-end justify-between gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-sm ${i / 24 < pos ? 'bg-white/80' : 'bg-[var(--app-surface-muted)]'}`}
              style={{ height: `${8 + (i % 3) * 4}px` }}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 top-0 flex justify-between text-[9px] text-[var(--app-text-muted)]">
          <span>-1,0×</span>
          <span>1,0×</span>
          <span>3,0×</span>
        </div>
      </div>
    </div>
  )
}

export function WhoopHealthspanBar({
  metric,
  onInfo,
  expanded,
  onToggle,
}: {
  metric: HealthspanMetric
  onInfo?: () => void
  expanded?: boolean
  onToggle?: () => void
}) {
  const impactColor = metric.impactYears <= 0 ? 'text-emerald-400' : 'text-orange-400'
  const impactSign = metric.impactYears <= 0 ? '' : '+'

  return (
    <div className="border-b border-white/[0.06] py-3 last:border-0">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">{metric.label}</p>
          <p className="mt-1 text-lg font-bold text-white">{metric.value}</p>
        </div>
        <p className={`shrink-0 text-sm font-bold tabular-nums ${impactColor}`}>
          {impactSign}
          {metric.impactYears.toFixed(1).replace('.', ',')} Jahre
        </p>
      </button>
      <div className="relative mt-3 h-3 overflow-hidden rounded-sm">
        <div className="absolute inset-0 flex">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-full flex-1 border-r border-black/20"
              style={{
                background: metric.invertScale
                  ? i < 10
                    ? `hsl(${150 - i * 4}, 60%, ${35 + i}%)`
                    : `hsl(${30 + (i - 10) * 3}, 70%, 45%)`
                  : i < 10
                    ? `hsl(${30 + i * 2}, 70%, 45%)`
                    : `hsl(${150 - (i - 10) * 4}, 55%, ${40 + (i - 10)}%)`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute -top-1 h-0 w-0 border-x-[5px] border-b-[6px] border-x-transparent border-b-white"
          style={{ left: `calc(${metric.position * 100}% - 5px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[8px] text-[var(--app-text-muted)]">
        <span>{metric.min}</span>
        <span>{metric.max}</span>
      </div>
      {expanded && metric.insight ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--app-text-muted)]">{metric.insight}</p>
      ) : null}
      {expanded ? (
        <button type="button" onClick={onInfo} className="mt-2 text-[10px] font-bold uppercase text-sky-400">
          Trend ansehen →
        </button>
      ) : null}
    </div>
  )
}

export function WhoopLiveHrMonitor({
  bpm,
  zone,
  history,
  onInfo,
}: {
  bpm: number | null
  zone: number
  history: FitnessHrPoint[]
  onInfo?: () => void
}) {
  const pts = history.slice(-24)
  const vals = pts.map((p) => p.bpm)
  const min = vals.length ? Math.min(...vals) - 5 : 50
  const max = vals.length ? Math.max(...vals) + 5 : 120
  const range = max - min || 1

  return (
    <button
      type="button"
      onClick={onInfo}
      className="w-full rounded-2xl border border-white/[0.06] bg-[#111113] p-4 text-left"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">Herzfrequenz</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-2xl text-sky-400">♥</span>
        <div>
          <p className="text-5xl font-bold tabular-nums text-white">{bpm ?? '—'}</p>
          <p className="text-xs text-[var(--app-text-muted)]">S/min · Zone {zone}</p>
        </div>
      </div>
      <svg viewBox="0 0 320 48" className="mt-3 w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            y1={f * 48}
            x2={320}
            y2={f * 48}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {pts.length > 1 ? (
          <polyline
            points={pts
              .map((p, i) => {
                const x = (i / Math.max(pts.length - 1, 1)) * 320
                const y = 44 - ((p.bpm - min) / range) * 40
                return `${x},${y}`
              })
              .join(' ')}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
          />
        ) : null}
        {pts.length > 0 ? (
          <circle
            cx={320}
            cy={44 - ((pts[pts.length - 1]!.bpm - min) / range) * 40}
            r={4}
            fill="white"
          />
        ) : null}
      </svg>
    </button>
  )
}

export function WhoopAgeTrendChart({ model }: { model: HealthspanModel }) {
  const h = 100
  const ages = model.trendMonths.map((m) => m.whoopAge ?? m.chronoAge)
  const min = Math.min(...ages, model.chronologicalAge) - 1
  const max = Math.max(...ages, model.chronologicalAge) + 1
  const range = max - min || 1

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Whoop-Alter Trend</p>
      <div className="mt-2 flex gap-3 text-[9px] text-[var(--app-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-400" />
          Dein Omnia-Alter
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-white" />
          Chronologisches Alter
        </span>
      </div>
      <svg viewBox={`0 0 360 ${h}`} className="mt-2 w-full">
        {model.trendMonths.map((m, i) => {
          const x = 30 + (i / Math.max(model.trendMonths.length - 1, 1)) * 300
          return (
            <text key={m.label} x={x} y={h - 2} textAnchor="middle" fill="#71717a" fontSize="8">
              {m.label}
            </text>
          )
        })}
        <polyline
          points={model.trendMonths
            .map((m, i) => {
              const x = 30 + (i / Math.max(model.trendMonths.length - 1, 1)) * 300
              const y = 12 + (1 - (m.chronoAge - min) / range) * (h - 24)
              return `${x},${y}`
            })
            .join(' ')}
          fill="none"
          stroke="white"
          strokeWidth="2"
        />
        <polyline
          points={model.trendMonths
            .filter((m) => m.whoopAge != null)
            .map((m, i, arr) => {
              const idx = model.trendMonths.indexOf(m)
              const x = 30 + (idx / Math.max(model.trendMonths.length - 1, 1)) * 300
              const y = 12 + (1 - (m.whoopAge! - min) / range) * (h - 24)
              return `${x},${y}`
            })
            .join(' ')}
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

export function WhoopAgingTrendChart({ model }: { model: HealthspanModel }) {
  const h = 90
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Alterungsprozess Trend</p>
      <svg viewBox={`0 0 360 ${h}`} className="mt-2 w-full">
        <line x1={20} y1={45} x2={340} y2={45} stroke="white" strokeWidth="1" opacity="0.5" />
        <polyline
          points={model.agingTrendLine
            .map((p, i) => {
              const x = 30 + (i / Math.max(model.agingTrendLine.length - 1, 1)) * 300
              const y = 12 + (1 - (p.value + 1) / 4) * (h - 24)
              return `${x},${y}`
            })
            .join(' ')}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
        />
        {model.agingTrendLine.map((p, i) => (
          <text
            key={p.label}
            x={30 + (i / Math.max(model.agingTrendLine.length - 1, 1)) * 300}
            y={h - 2}
            textAnchor="middle"
            fill="#71717a"
            fontSize="8"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

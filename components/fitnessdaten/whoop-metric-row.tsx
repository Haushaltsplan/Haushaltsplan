'use client'

import type { MetricMitBaseline } from '@/lib/fitnessdaten/metrics-engine'

function formatVal(v: number | null, dec = 0): string {
  if (v == null) return '—'
  return dec > 0 ? v.toFixed(dec).replace('.', ',') : String(Math.round(v))
}

function TrendIcon({ trend, invertiert }: { trend: MetricMitBaseline['trend']; invertiert?: boolean }) {
  if (trend === 'neutral') return <span className="text-[var(--app-text-muted)]">—</span>
  const good = invertiert ? trend === 'down' : trend === 'up'
  const sym = trend === 'up' ? '▲' : '▼'
  return <span style={{ color: good ? '#00E676' : '#FF1744' }}>{sym}</span>
}

export function WhoopMetricRow({
  icon,
  label,
  m,
  unit = '',
  decimals = 0,
  onPress,
  onInfo,
}: {
  icon: string
  label: string
  m: MetricMitBaseline
  unit?: string
  decimals?: number
  onPress?: () => void
  onInfo?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPress ?? onInfo}
      className={`flex w-full items-center gap-3 border-b border-white/[0.06] py-3.5 text-left last:border-0 ${onPress || onInfo ? 'hover:bg-white/[0.02]' : ''}`}
    >
      <span className="w-6 text-center text-lg opacity-80">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold tabular-nums text-white">
          {formatVal(m.heute, decimals)}
          {unit ? <span className="ml-1 text-xs font-normal text-[var(--app-text-muted)]">{unit}</span> : null}
        </p>
        <p className="text-[10px] tabular-nums text-[var(--app-text-muted)]">
          {formatVal(m.baseline30, decimals)}
          <span className="ml-2 inline-block">
            <TrendIcon trend={m.trend} invertiert={m.invertiert} />
          </span>
        </p>
      </div>
    </button>
  )
}

export function WhoopInsightCard({ text, link }: { text: string; link?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00E676]" style={{ boxShadow: '0 0 6px #00E676' }} />
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#00E676]">Einblick</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--app-text)]">{text}</p>
      {link ? (
        <p className="mt-3 text-[11px] font-semibold tracking-wide text-[var(--app-text-muted)]">{link} →</p>
      ) : null}
    </div>
  )
}

export function WhoopHealthTile({
  icon,
  label,
  value,
  unit,
  status,
  statusTone,
  onPress,
}: {
  icon: string
  label: string
  value: string
  unit?: string
  status?: string
  statusTone?: 'ok' | 'warn' | 'bad'
  onPress?: () => void
}) {
  const tone =
    statusTone === 'bad'
      ? 'bg-red-950/50 text-red-300 border-red-900/50'
      : statusTone === 'warn'
        ? 'bg-orange-950/50 text-orange-200 border-orange-900/50'
        : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/40'

  const inner = (
    <>
      <span className="text-lg">{icon}</span>
      <p className="mt-2 text-[9px] font-bold uppercase leading-tight tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 break-words text-lg font-bold tabular-nums text-white">
        {value}
        {unit ? <span className="text-xs font-normal text-[var(--app-text-muted)]"> {unit}</span> : null}
      </p>
      {status ? (
        <p className={`mt-2 break-words rounded-md border px-1.5 py-0.5 text-[8px] font-semibold leading-snug ${tone}`}>
          {status}
        </p>
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="min-w-0 rounded-2xl border border-white/[0.06] bg-[#111113] p-3 text-left transition active:scale-[0.98] hover:border-white/[0.12]"
      >
        {inner}
      </button>
    )
  }

  return <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-[#111113] p-3">{inner}</div>
}

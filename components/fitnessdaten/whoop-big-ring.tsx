'use client'

import { recoveryColor } from '@/components/fitnessdaten/whoop-ring'

export function WhoopBigRing({
  value,
  max = 100,
  label,
  sublabel,
  color,
  size = 200,
}: {
  value: number | null
  max?: number
  label: string
  sublabel?: string
  color?: string
  size?: number
}) {
  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const unavailable = value == null
  const pct = unavailable ? 0 : Math.min(1, Math.max(0, value / max))
  const ringColor = color ?? (max === 100 ? recoveryColor(value) : '#009dff')
  const display = unavailable ? '—' : max === 100 ? `${Math.round(value!)}%` : value!.toFixed(1)

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          {!unavailable ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={stroke}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ filter: `drop-shadow(0 0 8px ${ringColor}80)` }}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--app-text-muted)]">OMNIA</span>
          <span className="mt-1 text-5xl font-bold tabular-nums text-white">{display}</span>
          <span className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">{label}</span>
          {sublabel ? <span className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">{sublabel}</span> : null}
        </div>
      </div>
    </div>
  )
}

export function WhoopMiniRings({
  strain,
  sleep,
}: {
  strain: number | null
  sleep: number | null
}) {
  return (
    <div className="flex justify-center gap-8">
      <MiniRing value={strain} max={21} label="Belastung" color="#009dff" />
      <MiniRing value={sleep} max={100} label="Schlaf" color="#00E5FF" unit="%" />
    </div>
  )
}

function MiniRing({
  value,
  max,
  label,
  color,
  unit,
}: {
  value: number | null
  max: number
  label: string
  color: string
  unit?: string
}) {
  const size = 72
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = value != null ? Math.min(1, value / max) : 0
  const display = value != null ? (unit === '%' ? `${Math.round(value)}%` : value.toFixed(1)) : '—'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#222" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          {display}
        </text>
      </svg>
      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">{label}</span>
    </div>
  )
}

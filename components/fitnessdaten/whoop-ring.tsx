'use client'

type Props = {
  value: number
  max?: number
  label: string
  sublabel?: string
  color: string
  size?: number
  stroke?: number
  unavailable?: boolean
  onPress?: () => void
}

export function WhoopRing({
  value,
  max = 100,
  label,
  sublabel,
  color,
  size = 96,
  stroke = 7,
  unavailable = false,
  onPress,
}: Props) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = unavailable ? 0 : Math.min(1, Math.max(0, value / max))
  const offset = circ * (1 - pct)
  const display = unavailable ? '—' : max === 100 ? `${Math.round(value)}%` : value.toFixed(1)

  const content = (
    <>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={stroke}
          />
          {!unavailable ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
              style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold tabular-nums tracking-tight text-white ${max === 21 ? 'text-xl' : 'text-lg'}`}
          >
            {display}
          </span>
          {max === 21 ? (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">/ 21</span>
          ) : null}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
          {label}
        </p>
        {sublabel ? <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">{sublabel}</p> : null}
      </div>
    </>
  )

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="flex flex-col items-center gap-2 rounded-2xl outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.98]"
        aria-label={`${label} — Details öffnen`}
      >
        {content}
      </button>
    )
  }

  return <div className="flex flex-col items-center gap-2">{content}</div>
}

export function recoveryColor(percent: number | null | undefined): string {
  if (percent == null) return '#52525b'
  if (percent >= 67) return '#00E676'
  if (percent >= 34) return '#FFD600'
  return '#FF1744'
}

export function recoveryLabelDe(label: string | null | undefined): string {
  if (label === 'optimal') return 'Optimal'
  if (label === 'ausreichend') return 'Ausreichend'
  if (label === 'niedrig') return 'Niedrig'
  return '—'
}

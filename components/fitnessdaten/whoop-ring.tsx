'use client'

import { useWhoopReveal } from '@/components/fitnessdaten/whoop-chart-kit'
import {
  SLEEP_GRADIENT,
  STRAIN_GRADIENT,
  WHOOP_COLORS,
  recoveryColorToken,
  recoveryGradient,
  withAlpha,
} from '@/components/fitnessdaten/whoop-design-tokens'
import { useId, type ReactNode } from 'react'

export type WhoopRingKind = 'recovery' | 'strain' | 'sleep' | 'custom'

export function ringGradientFuer(
  kind: WhoopRingKind,
  value: number | null | undefined,
  color?: string,
): readonly [string, string] {
  if (kind === 'recovery') return recoveryGradient(value)
  if (kind === 'strain') return STRAIN_GRADIENT
  if (kind === 'sleep') return SLEEP_GRADIENT
  const c = color ?? WHOOP_COLORS.sleep
  return [withAlpha(c, 0.7), c]
}

/** Reiner Kreis-Fortschritt mit Verlauf + Einzeichnen — Basis aller Whoop-Ringe. */
export function WhoopProgressArc({
  size,
  stroke,
  pct,
  gradient,
  glow = true,
  children,
}: {
  size: number
  stroke: number
  pct: number | null
  gradient: readonly [string, string]
  glow?: boolean
  children?: ReactNode
}) {
  const id = `wring-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const shown = useWhoopReveal()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const ziel = pct == null ? 0 : Math.min(1, Math.max(0, pct))
  const offset = circ * (1 - (shown ? ziel : 0))

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block -rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={WHOOP_COLORS.track} strokeWidth={stroke} />
        {pct != null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={glow ? { filter: `drop-shadow(0 0 ${Math.round(stroke * 0.8)}px ${withAlpha(gradient[1], 0.55)})` } : undefined}
          />
        ) : null}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div> : null}
    </div>
  )
}

type Props = {
  value: number
  max?: number
  label: string
  sublabel?: string
  color: string
  kind?: WhoopRingKind
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
  kind = 'custom',
  size = 96,
  stroke = 7,
  unavailable = false,
  onPress,
}: Props) {
  const pct = unavailable ? null : value / max
  const gradient = ringGradientFuer(kind, value, color)

  const content = (
    <>
      <WhoopProgressArc size={size} stroke={stroke} pct={pct} gradient={gradient}>
        <RingWert value={unavailable ? null : value} max={max} gross={false} />
      </WhoopProgressArc>
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
          {label}
        </p>
        {sublabel ? <p className="mt-0.5 text-[10px] text-[#8B93A1]">{sublabel}</p> : null}
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

/** Primärwert im Ring: große Zahl, kleine Einheit. */
export function RingWert({ value, max, gross }: { value: number | null; max: number; gross: boolean }) {
  if (value == null) {
    return <span className={`font-bold text-[#6B7280] ${gross ? 'text-5xl' : 'text-xl'}`}>—</span>
  }
  const prozent = max === 100
  const zahl = prozent ? String(Math.round(value)) : value.toFixed(1).replace('.', ',')
  return (
    <span className="flex items-baseline leading-none">
      <span className={`font-bold tabular-nums tracking-tight text-white ${gross ? 'text-[3.25rem]' : 'text-[22px]'}`}>
        {zahl}
      </span>
      {prozent ? (
        <span className={`ml-0.5 font-semibold text-[#8B93A1] ${gross ? 'text-lg' : 'text-[11px]'}`}>%</span>
      ) : null}
    </span>
  )
}

/** Home-Ring (Schlaf | Erholung | Belastung) mit Label + Quellen-Badge. */
export function WhoopScoreRing({
  kind,
  value,
  max,
  label,
  onPress,
  badge,
  size = 108,
  stroke = 8,
}: {
  kind: Exclude<WhoopRingKind, 'custom'>
  value: number | null | undefined
  max: number
  label: string
  onPress?: () => void
  badge?: ReactNode
  size?: number
  stroke?: number
}) {
  const v = value ?? null
  const gradient = ringGradientFuer(kind, v)
  const labelColor = kind === 'recovery' ? recoveryColorToken(v) : gradient[1]

  return (
    <button
      type="button"
      onClick={onPress}
      className="flex flex-col items-center gap-1.5 rounded-2xl px-1 outline-none transition focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.97]"
    >
      <WhoopProgressArc size={size} stroke={stroke} pct={v == null ? null : v / max} gradient={gradient}>
        <RingWert value={v} max={max} gross={false} />
        {max === 21 && v != null ? (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#6B7280]">/ 21</span>
        ) : null}
      </WhoopProgressArc>
      <span className="flex flex-col items-center gap-0.5">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: labelColor }}>
          {label} <span className="text-[#6B7280]">›</span>
        </span>
        {badge}
      </span>
    </button>
  )
}

export function recoveryColor(percent: number | null | undefined): string {
  return recoveryColorToken(percent)
}

export function recoveryLabelDe(label: string | null | undefined): string {
  if (label === 'optimal') return 'Optimal'
  if (label === 'ausreichend') return 'Ausreichend'
  if (label === 'niedrig') return 'Niedrig'
  return '—'
}
